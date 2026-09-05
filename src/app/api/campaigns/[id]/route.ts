import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { processCampaignQueue } from "@/lib/campaign";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();

  // Tick the engine
  processCampaignQueue();

  const campaign = store.campaigns.get(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Enrich cases with customer/event data
  const cases = campaign.targetCaseIds
    .map(caseId => {
      const c = store.cases.get(caseId);
      if (!c) return null;
      const event = store.events.get(c.eventId);
      const customer = store.customers.get(c.customerId);
      return { ...c, event, customer };
    })
    .filter(Boolean);

  // Compute live stats
  const totalAtRisk = cases.reduce((sum, c) => sum + (c?.amountAtRisk || 0), 0);
  const automatedRecovered = cases.reduce((sum, c) => {
    if (c?.state === "RECOVERED" && !c.isHumanRecovery) return sum + c.amountRecovered;
    return sum;
  }, 0);
  const humanRecovered = cases.reduce((sum, c) => {
    if (c?.state === "RECOVERED" && c.isHumanRecovery) return sum + c.humanRecoveredAmount;
    return sum;
  }, 0);
  const totalRecovered = automatedRecovered + humanRecovered;
  const recoveryRate = totalAtRisk > 0 ? (totalRecovered / totalAtRisk) * 100 : 0;

  // Queue state
  const processing = cases.filter(c => c && ["DIAGNOSING", "ACTION_SELECTED", "ACTION_EXECUTING"].includes(c.state));
  const upNext = cases.filter(c => c && ["DETECTED", "VOICE_SCHEDULED"].includes(c.state));
  const waiting = cases.filter(c => c && ["DELAYED_RETRY_SCHEDULED", "FAILED", "WAITING_FOR_RESULT"].includes(c.state));
  const escalated = cases.filter(c => c && ["ESCALATED", "HUMAN_CONTROLLED"].includes(c.state));
  const recovered = cases.filter(c => c && c.state === "RECOVERED");
  const stopped = cases.filter(c => c && c.state === "STOPPED");

  // Recent activity
  const activities = store.activityFeed
    .filter(a => {
      if (!a.caseId) return false;
      return campaign.targetCaseIds.includes(a.caseId);
    })
    .slice(0, 20);

  return NextResponse.json({
    campaign: {
      ...campaign,
      totalTargetAmount: totalAtRisk,
      totalRecoveredAmount: totalRecovered,
      humanRecoveredAmount: humanRecovered,
    },
    cases,
    stats: {
      totalAtRisk,
      automatedRecovered,
      humanRecovered,
      totalRecovered,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      total: cases.length,
      processing: processing.length,
      upNext: upNext.length,
      waiting: waiting.length,
      escalated: escalated.length,
      recovered: recovered.length,
      stopped: stopped.length,
    },
    queue: {
      processing,
      upNext: upNext.sort((a, b) => 
        new Date(a?.scheduledFor || 0).getTime() - new Date(b?.scheduledFor || 0).getTime()
      ).slice(0, 10),
      waiting: waiting.sort((a, b) => 
        new Date(a?.nextAttemptAt || 0).getTime() - new Date(b?.nextAttemptAt || 0).getTime()
      ).slice(0, 10),
    },
    escalated,
    activities,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();
  const campaign = store.campaigns.get(id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "pause":
      if (campaign.status === "RUNNING") {
        campaign.status = "PAUSED";
      }
      break;
    case "resume":
      if (campaign.status === "PAUSED") {
        campaign.status = "RUNNING";
      }
      break;
    case "stop":
      if (["RUNNING", "PAUSED", "SCHEDULED"].includes(campaign.status)) {
        campaign.status = "STOPPED";
        campaign.completedAt = new Date().toISOString();
      }
      break;
    default:
      return NextResponse.json({ error: "Invalid action. Use: pause, resume, stop" }, { status: 400 });
  }

  return NextResponse.json({ campaign });
}
