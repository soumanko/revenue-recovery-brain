import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { processCampaignQueue } from "@/lib/campaign";
import type { RecoveryCampaign } from "@/lib/types";

export async function GET() {
  const store = getStore();
  
  // Before returning, tick the engine
  processCampaignQueue();

  const campaigns = Array.from(store.campaigns.values()).map(campaign => {
    // Enrich with computed stats
    const cases = campaign.targetCaseIds
      .map(id => store.cases.get(id))
      .filter(Boolean);
    
    const totalAtRisk = cases.reduce((sum, c) => sum + (c?.amountAtRisk || 0), 0);
    const totalRecovered = cases.reduce((sum, c) => sum + (c?.amountRecovered || 0), 0);
    const humanRecovered = cases.reduce((sum, c) => sum + (c?.humanRecoveredAmount || 0), 0);

    return {
      ...campaign,
      totalTargetAmount: totalAtRisk,
      totalRecoveredAmount: totalRecovered,
      humanRecoveredAmount: humanRecovered,
    };
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const store = getStore();
  const body = await request.json();

  const {
    name,
    scheduledFor,
    voiceEnabled = true,
    maxAttempts = 3,
    dailyVoiceLimit = 3,
    demoMode = true,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  // Get all eligible cases (DETECTED state)
  const eligibleCases = Array.from(store.cases.values())
    .filter(c => c.state === "DETECTED");

  if (eligibleCases.length === 0) {
    return NextResponse.json({ error: "No eligible recovery cases found. Try resetting data." }, { status: 400 });
  }

  const campaignId = store.nextCampaignId();
  const totalAtRisk = eligibleCases.reduce((sum, c) => sum + c.amountAtRisk, 0);

  // Associate cases with campaign
  for (const c of eligibleCases) {
    c.campaignId = campaignId;
  }

  const campaign: RecoveryCampaign = {
    id: campaignId,
    name,
    status: scheduledFor ? "SCHEDULED" : "RUNNING",
    targetCaseIds: eligibleCases.map(c => c.id),
    processedCaseIds: [],
    recoveredCaseIds: [],
    failedCaseIds: [],
    escalatedCaseIds: [],
    totalTargetAmount: totalAtRisk,
    totalRecoveredAmount: 0,
    humanRecoveredAmount: 0,
    scheduledFor: scheduledFor || undefined,
    startedAt: scheduledFor ? undefined : new Date().toISOString(),
    createdAt: new Date().toISOString(),
    voiceEnabled,
    maxAttempts: Math.min(maxAttempts, 3), // Hard ceiling
    dailyVoiceLimit,
    demoMode,
  };

  store.campaigns.set(campaignId, campaign);

  return NextResponse.json({
    campaign,
    eligibleCases: eligibleCases.length,
    totalAtRisk,
  });
}
