import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import { processBatchAsync } from "@/lib/agent";

export async function POST(request: Request) {
  const store = getStore();
  const body = await request.json();

  const count = body.count || 500;

  // Find unprocessed cases
  const unprocessedCases = Array.from(store.cases.values())
    .filter((c) => c.state === "DETECTED")
    .slice(0, count);

  if (unprocessedCases.length === 0) {
    return NextResponse.json({ error: "No unprocessed cases available. Try resetting data." }, { status: 400 });
  }

  const batchId = `BATCH_${uuidv4().slice(0, 8)}`;
  const totalAtRisk = unprocessedCases.reduce((sum, c) => sum + c.amountAtRisk, 0);

  // Mark cases with batch ID
  for (const c of unprocessedCases) {
    c.batchId = batchId;
  }

  store.batches.set(batchId, {
    id: batchId,
    totalCases: unprocessedCases.length,
    processedCases: 0,
    recoveredCases: 0,
    failedCases: 0,
    stoppedCases: 0,
    escalatedCases: 0,
    totalAtRisk,
    totalRecovered: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  // Process batch asynchronously in the background
  // Fire and forget (do not await)
  processBatchAsync(batchId, unprocessedCases.map((c) => c.id)).catch(console.error);

  const batch = store.batches.get(batchId)!;

  return NextResponse.json({ batch });
}

export async function GET(request: Request) {
  const store = getStore();
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("id");

  if (batchId) {
    const batch = store.batches.get(batchId);
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    return NextResponse.json({ batch });
  }

  const batches = Array.from(store.batches.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ batches });
}
