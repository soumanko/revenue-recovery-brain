import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { recordAuditEvent, recordActivity } from "@/lib/agent";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();

  const recoveryCase = store.cases.get(id);
  if (!recoveryCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Can only take over cases that are ESCALATED or still active
  if (["RECOVERED", "STOPPED", "HUMAN_CONTROLLED"].includes(recoveryCase.state)) {
    return NextResponse.json({ 
      error: `Cannot take over case in state ${recoveryCase.state}` 
    }, { status: 400 });
  }

  const event = store.events.get(recoveryCase.eventId);
  const customer = store.customers.get(recoveryCase.customerId);

  // Transition to HUMAN_CONTROLLED
  recoveryCase.state = "HUMAN_CONTROLLED";
  recoveryCase.humanTakeoverAt = new Date().toISOString();
  recoveryCase.updatedAt = new Date().toISOString();
  
  // Stop all future automated actions
  recoveryCase.nextAttemptAt = undefined;
  recoveryCase.scheduledFor = undefined;

  // Record audit event
  recordAuditEvent({
    eventId: recoveryCase.eventId,
    caseId: id,
    decision: "human_takeover",
    reason: `Case taken over by human operator. All future automated recovery actions stopped. ${recoveryCase.totalAttempts} automated attempts preserved.`,
    amountAtRisk: recoveryCase.amountAtRisk,
    amountRecovered: recoveryCase.amountRecovered,
    agentState: "HUMAN_CONTROLLED",
  });

  // Record activity
  recordActivity({
    caseId: id,
    eventId: recoveryCase.eventId,
    message: `Human takeover: ${customer?.name || "Customer"} — automated recovery stopped after ${recoveryCase.totalAttempts} attempts. Manual outreach assigned.`,
    type: "human_takeover",
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
