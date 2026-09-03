import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const store = getStore();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "30");

  const feed = store.activityFeed.slice(0, limit);
  return NextResponse.json({ feed });
}
