import { getStore } from "./store";
import { processRecoveryCase, recordActivity, recordAuditEvent } from "./agent";
import type { RecoveryCase } from "./types";

let isProcessing = false;

const MAX_ATTEMPTS = 3;

export function processCampaignQueue() {
  if (isProcessing) return; // Prevent overlapping loops
  isProcessing = true;

  try {
    const store = getStore();
    
    // Check SCHEDULED campaigns and start them if startTime has arrived
    const scheduledCampaigns = Array.from(store.campaigns.values()).filter(c => c.status === "SCHEDULED");
    for (const campaign of scheduledCampaigns) {
       if (campaign.scheduledFor && new Date(campaign.scheduledFor).getTime() <= Date.now()) {
          campaign.status = "RUNNING";
          campaign.startedAt = new Date().toISOString();
          recordActivity({
            message: `Campaign "${campaign.name}" has started automatically.`,
            type: "action",
          });
       }
    }

    // Find running campaigns
    const runningCampaigns = Array.from(store.campaigns.values()).filter(c => c.status === "RUNNING");
    
    for (const campaign of runningCampaigns) {
      const casesToProcess = campaign.targetCaseIds
        .map(id => store.cases.get(id))
        .filter((c): c is RecoveryCase => c !== undefined);

      let processedInThisTick = 0;
      let allResolved = true;

      for (const c of casesToProcess) {
        // Check if it's already in a terminal state
        if (["RECOVERED", "STOPPED", "ESCALATED", "HUMAN_CONTROLLED"].includes(c.state)) {
          if (!campaign.processedCaseIds.includes(c.id)) {
              campaign.processedCaseIds.push(c.id);
              if (c.state === "RECOVERED") {
                  if (!campaign.recoveredCaseIds.includes(c.id)) {
                    campaign.recoveredCaseIds.push(c.id);
                    campaign.totalRecoveredAmount += c.amountRecovered;
                    if (c.isHumanRecovery) {
                      campaign.humanRecoveredAmount += c.humanRecoveredAmount;
                    }
                  }
              } else if (c.state === "STOPPED") {
                  if (!campaign.failedCaseIds.includes(c.id)) {
                    campaign.failedCaseIds.push(c.id);
                  }
              } else if (c.state === "ESCALATED" || c.state === "HUMAN_CONTROLLED") {
                  if (!campaign.escalatedCaseIds.includes(c.id)) {
                    campaign.escalatedCaseIds.push(c.id);
                  }
              }
          }
          continue;
        }

        // Case is not resolved yet
        allResolved = false;

        // Limit processing to 1 item per tick for sequential processing
        if (processedInThisTick >= 1) continue;

        // Ensure case isn't actively locked/processing in UI
        if (c.state === "ACTION_EXECUTING" || c.state === "DIAGNOSING" || c.state === "ACTION_SELECTED") {
            continue; // Busy
        }

        // If it has a nextAttemptAt, wait for it
        if (c.nextAttemptAt && new Date(c.nextAttemptAt).getTime() > Date.now()) {
            continue;
        }

        // If it's VOICE_SCHEDULED, check if scheduled time arrived
        if (c.state === "VOICE_SCHEDULED") {
          if (c.scheduledFor && new Date(c.scheduledFor).getTime() > Date.now()) {
            continue; // Not time yet
          }
          // Time to execute voice recovery
          // But first: check if payment was already recovered
          if (c.amountRecovered > 0) {
            c.state = "RECOVERED";
            c.resolvedAt = new Date().toISOString();
            recordActivity({
              caseId: c.id,
              eventId: c.eventId,
              message: `Scheduled voice call cancelled — payment already recovered.`,
              type: "result",
            });
            recordAuditEvent({
              eventId: c.eventId,
              caseId: c.id,
              decision: "voice_call_cancelled",
              reason: "Payment already recovered before scheduled voice intervention.",
              amountAtRisk: c.amountAtRisk,
              amountRecovered: c.amountRecovered,
              agentState: "RECOVERED",
            });
            processedInThisTick++;
            continue;
          }

          // Check daily voice call limit for this customer
          const today = new Date().toISOString().slice(0, 10);
          const policy = store.policy;
          
          // Count voice calls for this customer today across ALL their cases
          const customerCases = Array.from(store.cases.values()).filter(cc => cc.customerId === c.customerId);
          let customerVoiceCallsToday = 0;
          for (const cc of customerCases) {
            if (cc.voiceCallsDate === today) {
              customerVoiceCallsToday += cc.voiceCallsToday;
            }
          }

          if (customerVoiceCallsToday >= policy.maxVoiceCallsPerDay) {
            // Blocked by daily limit — reschedule to tomorrow
            c.nextAttemptAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            c.state = "DELAYED_RETRY_SCHEDULED";
            recordActivity({
              caseId: c.id,
              eventId: c.eventId,
              message: `Voice call blocked — daily contact limit (${policy.maxVoiceCallsPerDay} calls/customer/day) reached. Rescheduled.`,
              type: "result",
            });
            recordAuditEvent({
              eventId: c.eventId,
              caseId: c.id,
              decision: "daily_limit_block",
              reason: `Customer has reached ${policy.maxVoiceCallsPerDay} voice calls today. Rescheduling to next eligible period.`,
              amountAtRisk: c.amountAtRisk,
              agentState: "DELAYED_RETRY_SCHEDULED",
            });
            processedInThisTick++;
            continue;
          }

          // Execute voice recovery
          processRecoveryCase(c.id, "execute_voice_recovery");
          processedInThisTick++;
          continue;
        }
        
        // Process DELAYED_RETRY_SCHEDULED — time has arrived
        if (c.state === "DELAYED_RETRY_SCHEDULED") {
          // Check if payment already recovered
          if (c.amountRecovered > 0) {
            c.state = "RECOVERED";
            c.resolvedAt = new Date().toISOString();
            recordActivity({
              caseId: c.id,
              eventId: c.eventId,
              message: `Scheduled retry cancelled — payment already recovered.`,
              type: "result",
            });
            processedInThisTick++;
            continue;
          }
          processRecoveryCase(c.id);
          processedInThisTick++;
          continue;
        }

        // Process DETECTED or FAILED cases
        if (c.state === "DETECTED" || c.state === "FAILED" || c.state === "WAITING_FOR_RESULT") {
           // Check if already at max attempts
           if (c.totalAttempts >= MAX_ATTEMPTS) {
             c.state = "ESCALATED";
             c.resolvedAt = new Date().toISOString();
             recordActivity({
               caseId: c.id,
               eventId: c.eventId,
               message: `Escalated: Maximum ${MAX_ATTEMPTS} automated attempts reached.`,
               type: "stop",
             });
             processedInThisTick++;
             continue;
           }
           processRecoveryCase(c.id);
           processedInThisTick++;
        }
      }

      // Check if campaign is complete (all cases resolved)
      if (allResolved && casesToProcess.length > 0) {
        campaign.status = "COMPLETED";
        campaign.completedAt = new Date().toISOString();
        recordActivity({
          message: `Campaign "${campaign.name}" completed. ${campaign.recoveredCaseIds.length} recovered, ${campaign.failedCaseIds.length} stopped, ${campaign.escalatedCaseIds.length} escalated.`,
          type: "recovery",
          amountRecovered: campaign.totalRecoveredAmount,
        });
      }
    }
  } finally {
    isProcessing = false;
  }
}
