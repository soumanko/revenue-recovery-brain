import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { processRecoveryCase } from "@/lib/agent";

export async function POST(request: Request) {
  const store = getStore();
  const body = await request.json();

  if (body.caseId) {
    // Process a single case
    try {
      const result = processRecoveryCase(body.caseId, body.requestedAction);
      return NextResponse.json({ success: true, case: result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "caseId required" }, { status: 400 });
}
