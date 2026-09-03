import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const store = getStore();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");

  const sorted = [...store.auditLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = sorted.length;
  const entries = sorted.slice(offset, offset + limit);

  return NextResponse.json({ entries, total, limit, offset });
}
