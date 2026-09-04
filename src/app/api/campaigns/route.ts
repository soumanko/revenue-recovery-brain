import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { processCampaignQueue } from "@/lib/campaign";

export async function GET() {
  const store = getStore();
  
  // Before returning, tick the engine
  processCampaignQueue();

  const campaigns = Array.from(store.campaigns.values());
  return NextResponse.json({ campaigns });
}
