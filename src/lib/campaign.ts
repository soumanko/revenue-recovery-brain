import { getStore } from "./store";
import { processRecoveryCase } from "./agent";
import type { RecoveryCase } from "./types";

let isProcessing = false;

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
       }
    }

    // Find running campaigns
    const runningCampaigns = Array.from(store.campaigns.values()).filter(c => c.status === "RUNNING");
    
    for (const campaign of runningCampaigns) {
      const casesToProcess = campaign.targetCaseIds
        .map(id => store.cases.get(id))
        .filter((c): c is RecoveryCase => c !== undefined);

      let processedInThisTick = 0;

      for (const c of casesToProcess) {
        // Check if it's already processed and not waiting
        if (["RECOVERED", "STOPPED", "ESCALATED"].includes(c.state)) {
          if (!campaign.processedCaseIds.includes(c.id)) {
              campaign.processedCaseIds.push(c.id);
              if (c.state === "RECOVERED") {
                  campaign.recoveredCaseIds.push(c.id);
                  campaign.totalRecoveredAmount += c.amountRecovered;
              } else if (c.state === "FAILED" || c.state === "STOPPED") {
                  campaign.failedCaseIds.push(c.id);
              } else if (c.state === "ESCALATED") {
                  campaign.escalatedCaseIds.push(c.id);
              }
          }
          continue;
        }

        // Limit processing to 1 item per tick for pacing (simulates realistic operations center)
        if (processedInThisTick >= 1) break;

        // Ensure case isn't actively locked/processing in UI
        if (c.state === "ACTION_EXECUTING" || c.state === "DIAGNOSING" || c.state === "ACTION_SELECTED") {
            continue; // Busy
        }

        // If it has a nextAttemptAt, wait for it
        if (c.nextAttemptAt && new Date(c.nextAttemptAt).getTime() > Date.now()) {
            continue;
        }

        // If it's VOICE_SCHEDULED, wait for scheduledFor
        if (c.state === "VOICE_SCHEDULED" && c.scheduledFor && new Date(c.scheduledFor).getTime() > Date.now()) {
            continue;
        }
        
        // Process
        if (c.state === "DELAYED_RETRY_SCHEDULED" || c.state === "DETECTED" || c.state === "FAILED") {
           // We process it automatically. If the next step is voice, it will move to VOICE_SCHEDULED.
           processRecoveryCase(c.id);
           processedInThisTick++;
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}
