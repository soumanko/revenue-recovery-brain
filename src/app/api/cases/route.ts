import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const store = getStore();
  const { searchParams } = new URL(request.url);

  const state = searchParams.get("state");
  const eventType = searchParams.get("eventType");
  const batchId = searchParams.get("batchId");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let cases = Array.from(store.cases.values());

  if (state) cases = cases.filter((c) => c.state === state);
  if (eventType) {
    const eventIds = new Set(
      Array.from(store.events.values())
        .filter((e) => e.eventType === eventType)
        .map((e) => e.id)
    );
    cases = cases.filter((c) => eventIds.has(c.eventId));
  }
  if (batchId) cases = cases.filter((c) => c.batchId === batchId);

  // Sort by creation date descending
  cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = cases.length;
  const paginated = cases.slice(offset, offset + limit);

  // Enrich with event and customer data
  const enriched = paginated.map((c) => {
    const event = store.events.get(c.eventId);
    const customer = store.customers.get(c.customerId);
    return {
      ...c,
      event,
      customer,
    };
  });

  return NextResponse.json({ cases: enriched, total, limit, offset });
}
