import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { recordAuditEvent, recordActivity } from "@/lib/agent";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();
  const body = await request.json();

  const recoveryCase = store.cases.get(id);
  if (!recoveryCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Can resolve cases that are ESCALATED or HUMAN_CONTROLLED
  if (!["ESCALATED", "HUMAN_CONTROLLED"].includes(recoveryCase.state)) {
    return NextResponse.json({ 
      error: `Cannot resolve case in state ${recoveryCase.state}. Must be ESCALATED or HUMAN_CONTROLLED.` 
    }, { status: 400 });
  }

  const { resolution, note } = body;
  
  const validResolutions = [
    "recovered_manually",
    "payment_no_longer_required",
    "customer_declined_permanently",
    "unable_to_recover",
    "other",
  ];

  if (!resolution || !validResolutions.includes(resolution)) {
    return NextResponse.json({ 
      error: `Invalid resolution. Valid options: ${validResolutions.join(", ")}` 
    }, { status: 400 });
  }

  const event = store.events.get(recoveryCase.eventId);
  const customer = store.customers.get(recoveryCase.customerId);

  const resolutionLabels: Record<string, string> = {
    recovered_manually: "Recovered manually",
    payment_no_longer_required: "Payment no longer required",
    customer_declined_permanently: "Customer declined permanently",
    unable_to_recover: "Unable to recover",
    other: "Other",
  };

  // Handle human resolution
  recoveryCase.humanResolution = resolution;
  recoveryCase.humanResolutionNote = note || undefined;
  recoveryCase.humanResolvedAt = new Date().toISOString();
  recoveryCase.resolvedAt = new Date().toISOString();
  recoveryCase.updatedAt = new Date().toISOString();

  // Stop future automated actions
  recoveryCase.nextAttemptAt = undefined;
  recoveryCase.scheduledFor = undefined;

  // If recovered manually, this is human recovery — not automated
  if (resolution === "recovered_manually") {
    recoveryCase.state = "RECOVERED";
    recoveryCase.isHumanRecovery = true;
    recoveryCase.humanRecoveredAmount = recoveryCase.amountAtRisk;
    recoveryCase.amountRecovered = recoveryCase.amountAtRisk;
    recoveryCase.recoveryChannel = "human manual recovery";
    recoveryCase.recoveryTimeMs = Date.now() - new Date(recoveryCase.createdAt).getTime();
  } else {
    // Non-recovery resolution: mark as STOPPED (handled, not recovered)
    recoveryCase.state = "STOPPED";
  }

  // Record audit event
  recordAuditEvent({
    eventId: recoveryCase.eventId,
    caseId: id,
    decision: "human_resolution",
    reason: `Case resolved by human: ${resolutionLabels[resolution]}${note ? ` — ${note}` : ""}`,
    amountAtRisk: recoveryCase.amountAtRisk,
    amountRecovered: recoveryCase.amountRecovered,
    agentState: recoveryCase.state,
    metadata: JSON.stringify({ resolution, note }),
  });

  // Record activity
  const recoveryMsg = resolution === "recovered_manually" 
    ? `₹${recoveryCase.amountAtRisk.toLocaleString("en-IN")} recovered manually`
    : `Resolution: ${resolutionLabels[resolution]}`;

  recordActivity({
    caseId: id,
    eventId: recoveryCase.eventId,
    message: `Human resolution: ${customer?.name || "Customer"} — ${recoveryMsg}${note ? `. Note: ${note}` : ""}`,
    type: "human_resolve",
    amountRecovered: resolution === "recovered_manually" ? recoveryCase.amountAtRisk : undefined,
  });

  return NextResponse.json({
    success: true,
    case: {
      ...recoveryCase,
      event,
      customer,
    },
  });
}
