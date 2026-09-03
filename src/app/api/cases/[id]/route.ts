import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();

  const recoveryCase = store.cases.get(id);
  if (!recoveryCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const event = store.events.get(recoveryCase.eventId);
  const customer = store.customers.get(recoveryCase.customerId);
  const actions = Array.from(store.actions.values())
    .filter((a) => a.caseId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const auditEntries = store.auditLog
    .filter((a) => a.caseId === id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const activities = store.activityFeed
    .filter((a) => a.caseId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return NextResponse.json({
    case: recoveryCase,
    event,
    customer,
    actions,
    auditEntries,
    activities,
  });
}
