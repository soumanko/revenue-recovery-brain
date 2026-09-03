import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ policy: store.policy });
}

export async function PUT(request: Request) {
  const store = getStore();
  const body = await request.json();

  if (body.maxRetries !== undefined) store.policy.maxRetries = body.maxRetries;
  if (body.maxCustomerContacts !== undefined) store.policy.maxCustomerContacts = body.maxCustomerContacts;
  if (body.recoveryWindowHours !== undefined) store.policy.recoveryWindowHours = body.recoveryWindowHours;
  if (body.minRecoveryProbabilityForRetry !== undefined) store.policy.minRecoveryProbabilityForRetry = body.minRecoveryProbabilityForRetry;
  if (body.minAmountForVoiceRecovery !== undefined) store.policy.minAmountForVoiceRecovery = body.minAmountForVoiceRecovery;
  if (body.enableVoiceRecovery !== undefined) store.policy.enableVoiceRecovery = body.enableVoiceRecovery;
  if (body.enableAutoRetry !== undefined) store.policy.enableAutoRetry = body.enableAutoRetry;
  store.policy.updatedAt = new Date().toISOString();

  return NextResponse.json({ policy: store.policy });
}
