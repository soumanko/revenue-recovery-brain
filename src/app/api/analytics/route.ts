import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();

  const cases = Array.from(store.cases.values());
  const events = Array.from(store.events.values());

  // By event type
  const eventTypeMap = new Map<string, { atRisk: number; recovered: number; count: number }>();
  for (const c of cases) {
    const event = store.events.get(c.eventId);
    if (!event) continue;
    const key = event.eventType;
    if (!eventTypeMap.has(key)) eventTypeMap.set(key, { atRisk: 0, recovered: 0, count: 0 });
    const entry = eventTypeMap.get(key)!;
    entry.atRisk += c.amountAtRisk;
    entry.recovered += c.amountRecovered;
    entry.count++;
  }

  // By intervention type
  const interventionMap = new Map<string, { recovered: number; count: number }>();
  for (const c of cases) {
    if (c.state !== "RECOVERED" || !c.recoveryChannel) continue;
    const key = c.recoveryChannel;
    if (!interventionMap.has(key)) interventionMap.set(key, { recovered: 0, count: 0 });
    const entry = interventionMap.get(key)!;
    entry.recovered += c.amountRecovered;
    entry.count++;
  }

  // By failure reason
  const failureReasonMap = new Map<string, { atRisk: number; recovered: number; count: number }>();
  for (const c of cases) {
    const event = store.events.get(c.eventId);
    if (!event) continue;
    const key = event.failureReason;
    if (!failureReasonMap.has(key)) failureReasonMap.set(key, { atRisk: 0, recovered: 0, count: 0 });
    const entry = failureReasonMap.get(key)!;
    entry.atRisk += c.amountAtRisk;
    entry.recovered += c.amountRecovered;
    entry.count++;
  }

  return NextResponse.json({
    byEventType: Array.from(eventTypeMap.entries()).map(([type, data]) => ({
      type,
      ...data,
    })),
    byIntervention: Array.from(interventionMap.entries()).map(([intervention, data]) => ({
      intervention,
      ...data,
    })),
    byFailureReason: Array.from(failureReasonMap.entries()).map(([reason, data]) => ({
      reason,
      ...data,
      rate: data.atRisk > 0 ? Math.round((data.recovered / data.atRisk) * 1000) / 10 : 0,
    })),
  });
}
