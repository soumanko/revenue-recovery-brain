import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function POST() {
  const store = getStore();
  store.reset();
  return NextResponse.json({ success: true, message: "Data reset and re-seeded", totalEvents: store.events.size });
}
