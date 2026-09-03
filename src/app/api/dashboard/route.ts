import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();

  const cases = Array.from(store.cases.values());
  const events = Array.from(store.events.values());

  const totalAtRisk = events.reduce((sum, e) => sum + e.amount, 0);
  const totalRecovered = cases.reduce((sum, c) => sum + c.amountRecovered, 0);
  const activeCases = cases.filter((c) => !["RECOVERED", "STOPPED", "ESCALATED"].includes(c.state)).length;
  const successfulRecoveries = cases.filter((c) => c.state === "RECOVERED").length;
  const stoppedCases = cases.filter((c) => c.state === "STOPPED").length;
  const escalatedCases = cases.filter((c) => c.state === "ESCALATED").length;
  const recoveryRate = totalAtRisk > 0 ? (totalRecovered / totalAtRisk) * 100 : 0;

  const recoveredCases = cases.filter((c) => c.state === "RECOVERED" && c.recoveryTimeMs);
  const averageRecoveryTimeMs =
    recoveredCases.length > 0
      ? recoveredCases.reduce((sum, c) => sum + (c.recoveryTimeMs || 0), 0) / recoveredCases.length
      : 0;

  return NextResponse.json({
    revenueAtRisk: totalAtRisk,
    revenueRecovered: totalRecovered,
    recoveryRate: Math.round(recoveryRate * 10) / 10,
    activeCases,
    successfulRecoveries,
    stoppedCases,
    escalatedCases,
    averageRecoveryTimeMs: Math.round(averageRecoveryTimeMs),
    totalEvents: events.length,
  });
}
