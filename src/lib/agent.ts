import type {
  RevenueRiskEvent,
  RecoveryCase,
  Customer,
  MerchantPolicy,
  DiagnosisResult,
  RecoveryScoreResult,
  ActionDecision,
  ExecutionResult,
  ActionType,
  Recoverability,
  AuditEntry,
  ActivityFeedItem,
  RecoveryAction,
  PolicyEvaluationResult,
} from "./types";
import { getStore, demoRng } from "./store";
import { v4 as uuidv4 } from "uuid";

// ─── Constants ──────────────────────────────────────────────
const TRANSIENT_FAILURES = new Set(["bank_timeout", "temporary_gateway_failure", "network_error"]);
const PERMANENT_FAILURES = new Set(["card_declined", "card_expired"]);
const MAX_ATTEMPTS = 3; // Hard ceiling — never exceeded

// Deterministic outcome map for flagship cases (by orderId)
const FLAGSHIP_OUTCOMES: Record<string, { attempt1: boolean; attempt2: boolean; attempt3: boolean; voice: boolean }> = {
  "ORD_A": { attempt1: false, attempt2: false, attempt3: false, voice: true },   // Rahul: retry fails, voice succeeds
  "ORD_B": { attempt1: true, attempt2: true, attempt3: true, voice: true },      // Priya: immediate retry succeeds
  "ORD_C": { attempt1: false, attempt2: true, attempt3: true, voice: true },     // Amit: first retry fails, delayed retry succeeds
  "ORD_D": { attempt1: false, attempt2: false, attempt3: false, voice: false },  // Sneha: permanently unrecoverable
  "ORD_E": { attempt1: false, attempt2: false, attempt3: false, voice: false },  // Vikram: all fail → escalation
};

// ─── Tool 1: Analyze Revenue Risk ───────────────────────────

export function analyzeRevenueRisk(event: RevenueRiskEvent): DiagnosisResult {
  const isTransient = TRANSIENT_FAILURES.has(event.failureReason);
  const isPermanent = PERMANENT_FAILURES.has(event.failureReason);
  const factors: string[] = [];

  // Analyze failure type
  if (isTransient) {
    factors.push(`Failure type "${event.failureReason}" is transient and often resolves on retry`);
  } else if (event.failureReason === "insufficient_funds") {
    factors.push("Insufficient funds may resolve after a delay when customer replenishes account");
  } else if (event.failureReason === "card_expired") {
    factors.push("Card expired — requires customer action to update payment method");
  } else if (event.failureReason === "card_declined") {
    factors.push("Card declined — permanent block by issuing bank, unrecoverable");
  } else if (event.failureReason === "authentication_failure") {
    factors.push("Authentication failure — customer may need to retry with correct credentials");
  } else if (event.failureReason === "abandoned") {
    factors.push("Customer abandoned checkout — a timely reminder may complete the purchase");
  }

  // Analyze event type
  if (event.eventType === "checkout_abandonment") {
    factors.push("Checkout abandonment — customer left before completing payment");
  } else if (event.eventType === "subscription_failure") {
    factors.push("Subscription payment failure — recurring billing disrupted");
  }

  // Determine recoverability
  let recoverability: Recoverability;
  if (isTransient) {
    recoverability = "highly_recoverable";
  } else if (event.failureReason === "insufficient_funds") {
    recoverability = "potentially_recoverable";
  } else if (event.eventType === "checkout_abandonment" || event.failureReason === "abandoned") {
    recoverability = "potentially_recoverable";
  } else if (event.failureReason === "authentication_failure") {
    recoverability = "potentially_recoverable";
  } else if (isPermanent) {
    recoverability = "permanently_unrecoverable";
  } else {
    recoverability = "unlikely";
  }

  const summary = generateDiagnosisSummary(event, isTransient, recoverability);

  return {
    failureType: event.failureReason,
    isTransient,
    recoverability,
    factors,
    summary,
  };
}

function generateDiagnosisSummary(event: RevenueRiskEvent, isTransient: boolean, recoverability: Recoverability): string {
  if (isTransient) {
    return `${event.failureReason.replace(/_/g, " ")} appears transient. Customer has completed ${event.previousSuccessfulPayments} previous payments successfully. Recovery probability is high.`;
  }
  if (event.failureReason === "insufficient_funds") {
    return `Payment failed due to insufficient funds. A delayed retry may succeed if customer replenishes their account.`;
  }
  if (event.failureReason === "card_expired") {
    return `Customer's card has expired. Recovery requires customer to update their payment method.`;
  }
  if (event.failureReason === "card_declined") {
    return `Card permanently declined by issuing bank. Recovery is not possible through automated retry.`;
  }
  if (event.eventType === "checkout_abandonment" || event.failureReason === "abandoned") {
    return `Customer abandoned checkout for ₹${event.amount.toLocaleString("en-IN")} order. A timely reminder may bring them back.`;
  }
  if (event.failureReason === "authentication_failure") {
    return `Authentication failed. Customer notification may prompt them to retry with correct credentials.`;
  }
  return `Payment failure: ${event.failureReason.replace(/_/g, " ")}. Recoverability assessed as ${recoverability.replace(/_/g, " ")}.`;
}

// ─── Tool 2: Get Customer Context ───────────────────────────

export function getCustomerContext(customerId: string): Customer | null {
  const store = getStore();
  return store.customers.get(customerId) || null;
}

// ─── Tool 3: Calculate Recovery Score ───────────────────────

export function calculateRecoveryScore(event: RevenueRiskEvent, customer: Customer, diagnosis: DiagnosisResult): RecoveryScoreResult {
  const factors: RecoveryScoreResult["factors"] = [];

  // Factor 1: Failure transience (weight: 30%)
  let transienceScore: number;
  if (diagnosis.isTransient) {
    transienceScore = 95;
  } else if (event.failureReason === "insufficient_funds") {
    transienceScore = 60;
  } else if (event.failureReason === "abandoned" || event.eventType === "checkout_abandonment") {
    transienceScore = 55;
  } else if (event.failureReason === "authentication_failure") {
    transienceScore = 45;
  } else if (event.failureReason === "card_expired") {
    transienceScore = 20;
  } else {
    transienceScore = 10; // card_declined etc
  }
  factors.push({ name: "Failure Transience", weight: 0.30, value: transienceScore, contribution: Math.round(transienceScore * 0.30 * 10) / 10 });

  // Factor 2: Customer history (weight: 25%)
  const successRate = customer.totalOrders > 0 ? (customer.successfulPayments / customer.totalOrders) * 100 : 50;
  factors.push({ name: "Customer History", weight: 0.25, value: Math.round(successRate), contribution: Math.round(successRate * 0.25 * 10) / 10 });

  // Factor 3: Retry freshness (weight: 15%) — penalize existing retries
  const retryPenalty = Math.max(0, 100 - event.retryCount * 30);
  factors.push({ name: "Retry Freshness", weight: 0.15, value: retryPenalty, contribution: Math.round(retryPenalty * 0.15 * 10) / 10 });

  // Factor 4: Time since failure (weight: 10%)
  const hoursSinceFailure = (Date.now() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60);
  const timeScore = Math.max(0, 100 - hoursSinceFailure * 2);
  factors.push({ name: "Time Freshness", weight: 0.10, value: Math.round(timeScore), contribution: Math.round(timeScore * 0.10 * 10) / 10 });

  // Factor 5: Transaction value relevance (weight: 10%)
  const valueScore = Math.min(100, (event.amount / 5000) * 60 + 40);
  factors.push({ name: "Transaction Value", weight: 0.10, value: Math.round(valueScore), contribution: Math.round(valueScore * 0.10 * 10) / 10 });

  // Factor 6: Customer loyalty (weight: 10%)
  const loyaltyScore = Math.min(100, customer.totalOrders * 6 + (customer.totalSpent > 50000 ? 25 : 0));
  factors.push({ name: "Customer Loyalty", weight: 0.10, value: Math.round(loyaltyScore), contribution: Math.round(loyaltyScore * 0.10 * 10) / 10 });

  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  const score = Math.max(0, Math.min(100, totalScore));

  const reasoning = `Recovery probability: ${score}%. ${diagnosis.summary} Customer has ${customer.successfulPayments} successful payments and average order of ₹${customer.averageOrderValue.toLocaleString("en-IN")}.`;

  return { score, factors, reasoning };
}

// ─── Tool 4: Policy Arbiter & Action Selection ──────────────

export function evaluatePolicy(
  recoveryCase: RecoveryCase,
  event: RevenueRiskEvent,
  action: ActionType,
  score: number,
  customer: Customer,
  policy: MerchantPolicy
): PolicyEvaluationResult {
  const violations: string[] = [];

  const hoursSinceDetection = (Date.now() - new Date(recoveryCase.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceDetection > policy.recoveryWindowHours) {
    violations.push(`Recovery window of ${policy.recoveryWindowHours} hours has expired.`);
  }

  // Hard ceiling: 3 attempts max (backend enforced, not policy-dependent)
  if (["immediate_retry", "delayed_retry"].includes(action)) {
    if (!policy.enableAutoRetry) {
      violations.push("Auto retry is disabled by merchant policy.");
    }
    if (recoveryCase.totalAttempts >= MAX_ATTEMPTS) {
      violations.push(`Max attempts (${MAX_ATTEMPTS}) reached. Case must be escalated.`);
    }
    if (score < policy.minRecoveryProbabilityForRetry) {
      violations.push(`Score ${score}% is below retry threshold ${policy.minRecoveryProbabilityForRetry}%.`);
    }
  }

  if (["customer_notification", "hinglish_voice_call", "schedule_voice_recovery", "execute_voice_recovery"].includes(action)) {
    if (recoveryCase.customerContacts >= policy.maxCustomerContacts) {
      violations.push(`Max customer contacts (${policy.maxCustomerContacts}) reached.`);
    }
  }

  if (["hinglish_voice_call", "schedule_voice_recovery", "execute_voice_recovery"].includes(action)) {
    if (!policy.enableVoiceRecovery) {
      violations.push("Voice recovery is disabled by merchant policy.");
    }
    if (event.amount < policy.minAmountForVoiceRecovery) {
      violations.push(`Amount ₹${event.amount} is below voice threshold ₹${policy.minAmountForVoiceRecovery}.`);
    }
    // Check daily voice call limit
    const today = new Date().toISOString().slice(0, 10);
    if (recoveryCase.voiceCallsDate === today && recoveryCase.voiceCallsToday >= policy.maxVoiceCallsPerDay) {
      violations.push(`Daily voice call limit (${policy.maxVoiceCallsPerDay}) reached for this customer today.`);
    }
    if (score < 40) {
      violations.push(`Score ${score}% is too low for voice recovery (min 40%).`);
    }
  }

  return {
    allowed: violations.length === 0,
    reason: violations.length === 0 ? "Action permitted by policy." : `Policy rejected: ${violations.join(" ")}`,
    violations,
    policySnapshot: JSON.stringify(policy)
  };
}

export function selectRecoveryAction(
  event: RevenueRiskEvent,
  customer: Customer,
  recoveryCase: RecoveryCase,
  score: number,
  diagnosis: DiagnosisResult,
  policy: MerchantPolicy
): ActionDecision {

  // ─── Hard stops first ─────────────────────────
  // 1. Permanently unrecoverable → stop immediately
  if (diagnosis.recoverability === "permanently_unrecoverable") {
    return {
      action: "stop_recovery",
      reason: `Failure "${event.failureReason}" is permanently unrecoverable. No automated recovery possible.`,
      confidence: 100,
      alternativeActions: [{ action: "escalation", reason: "Manual review if needed" }],
    };
  }

  // 2. Recovery window expired
  const hoursSinceDetection = (Date.now() - new Date(recoveryCase.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceDetection > policy.recoveryWindowHours) {
    return {
      action: "stop_recovery",
      reason: `Recovery window of ${policy.recoveryWindowHours} hours has expired.`,
      confidence: 100,
      alternativeActions: [],
    };
  }

  // 3. Max attempts reached → escalate (not stop)
  if (recoveryCase.totalAttempts >= MAX_ATTEMPTS) {
    return {
      action: "escalation",
      reason: `Maximum ${MAX_ATTEMPTS} automated attempts exhausted. Escalating to human intervention for manual review.`,
      confidence: 100,
      alternativeActions: [],
    };
  }

  // ─── Strategy selection by failure type ─────────
  const isTransient = diagnosis.isTransient;
  const attemptNum = recoveryCase.totalAttempts;

  // TRANSIENT failures: aggressive retry strategy
  if (isTransient) {
    // First attempt: immediate retry
    if (attemptNum === 0) {
      const retryCheck = evaluatePolicy(recoveryCase, event, "immediate_retry", score, customer, policy);
      if (retryCheck.allowed) {
        return {
          action: "immediate_retry",
          reason: `${event.failureReason.replace(/_/g, " ")} is transient. High probability (${score}%) retry permitted.`,
          confidence: score,
          alternativeActions: [{ action: "schedule_voice_recovery", reason: "Voice recovery as alternative" }],
        };
      }
    }

    // Second attempt: try voice if eligible, otherwise delayed retry
    if (attemptNum >= 1) {
      const voiceCheck = evaluatePolicy(recoveryCase, event, "schedule_voice_recovery", score, customer, policy);
      if (voiceCheck.allowed && event.amount >= policy.minAmountForVoiceRecovery) {
        return {
          action: "schedule_voice_recovery",
          reason: `Previous retry failed. Scheduling voice recovery for ₹${event.amount.toLocaleString("en-IN")} with ${score}% probability.`,
          confidence: score,
          alternativeActions: [{ action: "delayed_retry", reason: "Delayed retry as fallback" }],
        };
      }
      const delayedCheck = evaluatePolicy(recoveryCase, event, "delayed_retry", score, customer, policy);
      if (delayedCheck.allowed) {
        const delayMs = attemptNum === 1 ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5min then 15min for demo
        return {
          action: "delayed_retry",
          reason: `Scheduling delayed retry. Transient failure may resolve with time.`,
          confidence: score,
          nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
          delayReason: `Waiting ${Math.round(delayMs / 60000)} minutes for transient issue to resolve.`,
          alternativeActions: [],
        };
      }
    }
  }

  // INSUFFICIENT FUNDS: delayed retry with longer wait
  if (event.failureReason === "insufficient_funds") {
    if (attemptNum === 0) {
      const delayedCheck = evaluatePolicy(recoveryCase, event, "delayed_retry", score, customer, policy);
      if (delayedCheck.allowed) {
        return {
          action: "delayed_retry",
          reason: `Insufficient funds detected. Scheduling delayed retry to allow customer to replenish funds.`,
          confidence: score,
          nextAttemptAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10min for demo
          delayReason: "Waiting for customer funds to replenish.",
          alternativeActions: [],
        };
      }
    }
    // Voice recovery for high-value insufficient funds
    if (attemptNum >= 1) {
      const voiceCheck = evaluatePolicy(recoveryCase, event, "schedule_voice_recovery", score, customer, policy);
      if (voiceCheck.allowed) {
        return {
          action: "schedule_voice_recovery",
          reason: `Delayed retry unsuccessful. Scheduling voice recovery to assist customer with ₹${event.amount.toLocaleString("en-IN")} payment.`,
          confidence: score,
          alternativeActions: [],
        };
      }
      // Notification fallback
      const notifyCheck = evaluatePolicy(recoveryCase, event, "customer_notification", score, customer, policy);
      if (notifyCheck.allowed) {
        return {
          action: "customer_notification",
          reason: `Sending payment reminder to customer. Insufficient funds may have been resolved.`,
          confidence: score,
          alternativeActions: [],
        };
      }
    }
  }

  // CHECKOUT ABANDONMENT → notification
  if (event.eventType === "checkout_abandonment" || event.failureReason === "abandoned") {
    const notifyCheck = evaluatePolicy(recoveryCase, event, "customer_notification", score, customer, policy);
    if (notifyCheck.allowed) {
      return {
        action: "customer_notification",
        reason: `Customer abandoned checkout for ₹${event.amount.toLocaleString("en-IN")}. Sending recovery notification.`,
        confidence: Math.min(score + 10, 100),
        alternativeActions: [],
      };
    }
  }

  // AUTHENTICATION FAILURE → notification, then escalation
  if (event.failureReason === "authentication_failure") {
    if (attemptNum === 0) {
      const notifyCheck = evaluatePolicy(recoveryCase, event, "customer_notification", score, customer, policy);
      if (notifyCheck.allowed) {
        return {
          action: "customer_notification",
          reason: `Authentication failed. Notifying customer to retry with correct credentials.`,
          confidence: score,
          alternativeActions: [],
        };
      }
    }
    // After notification, escalate if still failing
    if (attemptNum >= 1) {
      return {
        action: "escalation",
        reason: `Authentication failure persists after notification. Escalating for manual review.`,
        confidence: score,
        alternativeActions: [],
      };
    }
  }

  // ─── Fallback strategy for any remaining cases ─────
  // Try delayed retry if score is decent
  if (score >= 35) {
    const delayedCheck = evaluatePolicy(recoveryCase, event, "delayed_retry", score, customer, policy);
    if (delayedCheck.allowed) {
      return {
        action: "delayed_retry",
        reason: `Moderate probability (${score}%). Scheduling delayed retry.`,
        confidence: score,
        nextAttemptAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        delayReason: "Waiting for conditions to improve.",
        alternativeActions: [],
      };
    }
  }

  // Try notification
  const notifyCheck = evaluatePolicy(recoveryCase, event, "customer_notification", score, customer, policy);
  if (notifyCheck.allowed) {
    return {
      action: "customer_notification",
      reason: `Retry unlikely to succeed (${score}%). Sending customer notification as fallback.`,
      confidence: score,
      alternativeActions: [],
    };
  }

  // Escalation
  if (score >= 15) {
    return {
      action: "escalation",
      reason: `Recovery score is ${score}%. Exhausted automated options. Escalating to manual review.`,
      confidence: score,
      alternativeActions: [],
    };
  }

  // Default: stop
  return {
    action: "stop_recovery",
    reason: `Recovery score ${score}% is too low and all options exhausted.`,
    confidence: 100 - score,
    alternativeActions: [],
  };
}

// ─── Tool 5: Execute Recovery Action ────────────────────────

export function executeRecoveryAction(
  recoveryCase: RecoveryCase,
  event: RevenueRiskEvent,
  action: ActionType,
  customer: Customer,
  diagnosis: DiagnosisResult
): ExecutionResult {

  // Check for flagship deterministic outcomes
  const flagship = FLAGSHIP_OUTCOMES[event.orderId];

  switch (action) {
    case "delayed_retry": {
      return {
        success: false,
        action,
        result: "awaiting_retry",
        amountRecovered: 0,
        details: `Payment retry scheduled for later. Agent will re-attempt when conditions may have improved.`,
        isSimulated: true,
        executionTimeMs: 100,
      };
    }
    case "immediate_retry": {
      const success = simulatePaymentRetry(event, diagnosis, recoveryCase, flagship);
      return {
        success,
        action,
        result: success ? "recovered" : "failed",
        amountRecovered: success ? event.amount : 0,
        details: success
          ? `Payment retry successful. ₹${event.amount.toLocaleString("en-IN")} recovered via automated retry.`
          : `Payment retry failed. ${event.failureReason.replace(/_/g, " ")} persists.`,
        isSimulated: true,
        executionTimeMs: Math.floor(demoRng.next() * 2000) + 500,
      };
    }

    case "customer_notification": {
      const success = simulateNotification(event, recoveryCase, flagship);
      return {
        success,
        action,
        result: success ? "recovered" : "failed",
        amountRecovered: success ? event.amount : 0,
        details: success
          ? `Customer responded to notification and completed payment. ₹${event.amount.toLocaleString("en-IN")} recovered.`
          : "Customer did not respond to recovery notification within the response window.",
        isSimulated: true,
        executionTimeMs: Math.floor(demoRng.next() * 3000) + 1000,
      };
    }

    case "schedule_voice_recovery": {
      return {
        success: false,
        action,
        result: "awaiting_retry",
        amountRecovered: 0,
        details: "Voice recovery scheduled. Agent will initiate Hinglish voice call at the scheduled time.",
        isSimulated: true,
        executionTimeMs: 100,
      };
    }

    case "execute_voice_recovery":
    case "hinglish_voice_call": {
      const success = simulateVoiceRecovery(event, customer, recoveryCase, flagship);
      return {
        success,
        action,
        result: success ? "recovered" : "failed",
        amountRecovered: success ? event.amount : 0,
        details: success
          ? `Hinglish voice recovery successful. ${customer.name} agreed to retry payment. ₹${event.amount.toLocaleString("en-IN")} recovered.`
          : `Voice call completed but customer ${demoRng.next() < 0.5 ? "declined to retry payment" : "did not answer the call"}.`,
        isSimulated: true,
        executionTimeMs: Math.floor(demoRng.next() * 120000) + 30000,
      };
    }

    case "escalation": {
      return {
        success: false,
        action,
        result: "escalated",
        amountRecovered: 0,
        details: `Case escalated to human intervention queue. Agent has exhausted all ${recoveryCase.totalAttempts} automated recovery attempts. Further automated contact is prohibited by the ${MAX_ATTEMPTS}-attempt policy. Manual outreach is recommended.`,
        isSimulated: true,
        executionTimeMs: Math.floor(demoRng.next() * 500) + 100,
      };
    }

    case "stop_recovery": {
      return {
        success: false,
        action,
        result: "stopped",
        amountRecovered: 0,
        details: "Recovery stopped per policy. No further automated actions will be taken.",
        isSimulated: true,
        executionTimeMs: 50,
      };
    }

    default:
      return {
        success: false,
        action,
        result: "failed",
        amountRecovered: 0,
        details: `Unknown action type: ${action}`,
        isSimulated: true,
        executionTimeMs: 0,
      };
  }
}

// ─── Simulation Functions (deterministic) ───────────────────

function simulatePaymentRetry(
  event: RevenueRiskEvent,
  diagnosis: DiagnosisResult,
  recoveryCase: RecoveryCase,
  flagship?: { attempt1: boolean; attempt2: boolean; attempt3: boolean; voice: boolean }
): boolean {
  // Flagship cases have deterministic outcomes
  if (flagship) {
    const attemptKey = `attempt${recoveryCase.totalAttempts + 1}` as keyof typeof flagship;
    return flagship[attemptKey] as boolean;
  }
  // For other cases: use seeded PRNG with realistic rates
  if (diagnosis.isTransient) {
    return demoRng.next() < 0.82; // 82% success for transient retries
  }
  if (event.failureReason === "insufficient_funds") {
    return demoRng.next() < 0.50; // 50% success after delay
  }
  return demoRng.next() < 0.12; // Low for other failures
}

function simulateNotification(
  event: RevenueRiskEvent,
  recoveryCase: RecoveryCase,
  flagship?: { attempt1: boolean; attempt2: boolean; attempt3: boolean; voice: boolean }
): boolean {
  if (flagship) {
    const attemptKey = `attempt${recoveryCase.totalAttempts + 1}` as keyof typeof flagship;
    return flagship[attemptKey] as boolean;
  }
  // Notifications: ~45% response rate, ~70% of respondents recover
  if (event.eventType === "checkout_abandonment" || event.failureReason === "abandoned") {
    return demoRng.next() < 0.40; // 40% recovery for cart abandonment
  }
  if (event.failureReason === "authentication_failure") {
    return demoRng.next() < 0.35; // 35% recover after auth failure notification
  }
  return demoRng.next() < 0.30; // General notification
}

function simulateVoiceRecovery(
  event: RevenueRiskEvent,
  customer: Customer,
  recoveryCase: RecoveryCase,
  flagship?: { attempt1: boolean; attempt2: boolean; attempt3: boolean; voice: boolean }
): boolean {
  if (flagship) {
    return flagship.voice;
  }
  // Voice recovery: high success for Hinglish speakers with transient failures
  if (TRANSIENT_FAILURES.has(event.failureReason) && customer.preferredLanguage === "hinglish") {
    return demoRng.next() < 0.82;
  }
  if (event.failureReason === "insufficient_funds") {
    return demoRng.next() < 0.65;
  }
  return demoRng.next() < 0.55;
}

// ─── Tool 6: Record Audit Event ─────────────────────────────

export function recordAuditEvent(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const store = getStore();
  const auditEntry: AuditEntry = {
    ...entry,
    id: `AUD_${uuidv4().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
  };
  store.auditLog.push(auditEntry);
  return auditEntry;
}

// ─── Tool 7: Record Activity ────────────────────────────────

export function recordActivity(item: Omit<ActivityFeedItem, "id" | "createdAt">): ActivityFeedItem {
  const store = getStore();
  const feedItem: ActivityFeedItem = {
    ...item,
    id: `FEED_${uuidv4().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.activityFeed.unshift(feedItem); // newest first
  // Keep feed to 500 items
  if (store.activityFeed.length > 500) {
    store.activityFeed = store.activityFeed.slice(0, 500);
  }
  return feedItem;
}

// ─── Agent Runner: Process a Single Case ────────────────────

export function processRecoveryCase(caseId: string, requestedAction?: ActionType): RecoveryCase {
  const store = getStore();
  const recoveryCase = store.cases.get(caseId);
  if (!recoveryCase) throw new Error(`Case ${caseId} not found`);

  const event = store.events.get(recoveryCase.eventId);
  if (!event) throw new Error(`Event ${recoveryCase.eventId} not found`);

  const customer = store.customers.get(recoveryCase.customerId);
  if (!customer) throw new Error(`Customer ${recoveryCase.customerId} not found`);

  const policy = store.policy;

  // Skip already resolved cases
  if (["RECOVERED", "STOPPED", "ESCALATED", "HUMAN_CONTROLLED"].includes(recoveryCase.state)) {
    return recoveryCase;
  }

  // ─── Pre-execution check: is payment already recovered? ─────
  // Cancel scheduled action if payment was already recovered
  if (recoveryCase.amountRecovered > 0 && recoveryCase.state !== "RECOVERED") {
    recoveryCase.state = "RECOVERED";
    recoveryCase.resolvedAt = new Date().toISOString();
    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Scheduled action cancelled — payment already recovered before execution.`,
      type: "result",
    });
    recordAuditEvent({
      eventId: event.id,
      caseId,
      decision: "scheduled_action_cancelled",
      reason: "Payment already recovered before scheduled intervention.",
      amountAtRisk: event.amount,
      amountRecovered: recoveryCase.amountRecovered,
      agentState: "RECOVERED",
    });
    recoveryCase.updatedAt = new Date().toISOString();
    return recoveryCase;
  }

  // ─── Hard ceiling: 3 attempts maximum ─────
  if (recoveryCase.totalAttempts >= MAX_ATTEMPTS) {
    recoveryCase.state = "ESCALATED";
    recoveryCase.resolvedAt = new Date().toISOString();
    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Escalated: Maximum ${MAX_ATTEMPTS} automated attempts exhausted. Manual outreach recommended.`,
      type: "stop",
    });
    recordAuditEvent({
      eventId: event.id,
      caseId,
      decision: "escalation",
      reason: `Maximum ${MAX_ATTEMPTS} automated attempts exhausted. Further automated contact prohibited.`,
      amountAtRisk: event.amount,
      agentState: "ESCALATED",
    });
    recoveryCase.updatedAt = new Date().toISOString();
    return recoveryCase;
  }

  // Step 1: DETECT (already done at creation)
  recordActivity({
    caseId,
    eventId: recoveryCase.eventId,
    message: `Processing ₹${event.amount.toLocaleString("en-IN")} ${event.eventType.replace(/_/g, " ")} for ${customer.name}`,
    type: "detection",
  });

  // Step 2: DIAGNOSE
  recoveryCase.state = "DIAGNOSING";
  recoveryCase.updatedAt = new Date().toISOString();

  const diagnosis = analyzeRevenueRisk(event);
  recoveryCase.recoverability = diagnosis.recoverability;
  recoveryCase.diagnosis = JSON.stringify(diagnosis);

  recordActivity({
    caseId,
    eventId: recoveryCase.eventId,
    message: `Diagnosed: ${event.failureReason.replace(/_/g, " ")} — ${diagnosis.recoverability.replace(/_/g, " ")}`,
    type: "diagnosis",
  });

  recordAuditEvent({
    eventId: event.id,
    caseId,
    decision: "diagnose",
    reason: diagnosis.summary,
    recoveryProbability: undefined,
    agentState: "DIAGNOSING",
    amountAtRisk: event.amount,
  });

  // Step 3: SCORE
  const scoreResult = calculateRecoveryScore(event, customer, diagnosis);
  recoveryCase.recoveryScore = scoreResult.score;
  recoveryCase.scoreBreakdown = JSON.stringify(scoreResult.factors);

  recordActivity({
    caseId,
    eventId: recoveryCase.eventId,
    message: `Recovery probability: ${scoreResult.score}%`,
    type: "scoring",
  });

  // Step 4: DECIDE
  let decision: ActionDecision;
  
  if (requestedAction) {
    const policyEval = evaluatePolicy(recoveryCase, event, requestedAction, scoreResult.score, customer, policy);
    if (!policyEval.allowed) {
      decision = { action: "stop_recovery", reason: policyEval.reason, confidence: 100, alternativeActions: [] };
    } else {
      decision = { action: requestedAction, reason: "Manual action requested via UI.", confidence: 100, alternativeActions: [] };
    }
  } else {
    decision = selectRecoveryAction(event, customer, recoveryCase, scoreResult.score, diagnosis, policy);
  }

  recoveryCase.state = "ACTION_SELECTED";
  recoveryCase.selectedAction = decision.action;
  recoveryCase.actionReason = decision.reason;

  recordActivity({
    caseId,
    eventId: recoveryCase.eventId,
    message: `Agent selected: ${decision.action.replace(/_/g, " ")}`,
    type: "action",
  });

  recordAuditEvent({
    eventId: event.id,
    caseId,
    decision: decision.action,
    reason: decision.reason,
    recoveryProbability: scoreResult.score,
    policy: `max_retries=${policy.maxRetries}, max_contacts=${policy.maxCustomerContacts}, window=${policy.recoveryWindowHours}h`,
    policySnapshot: JSON.stringify(policy),
    scoreBreakdown: recoveryCase.scoreBreakdown,
    agentState: "ACTION_SELECTED",
    amountAtRisk: event.amount,
  });

  // Step 5: EXECUTE
  recoveryCase.state = "ACTION_EXECUTING";
  recoveryCase.updatedAt = new Date().toISOString();

  const result = executeRecoveryAction(recoveryCase, event, decision.action, customer, diagnosis);

  // Track contacts and attempts
  if (["immediate_retry", "delayed_retry"].includes(decision.action)) {
    recoveryCase.totalAttempts++;
    event.retryCount++;
  }
  if (["customer_notification", "hinglish_voice_call", "execute_voice_recovery"].includes(decision.action)) {
    recoveryCase.customerContacts++;
    recoveryCase.totalAttempts++;
  }
  // Track voice calls per day
  if (["hinglish_voice_call", "execute_voice_recovery"].includes(decision.action)) {
    const today = new Date().toISOString().slice(0, 10);
    if (recoveryCase.voiceCallsDate !== today) {
      recoveryCase.voiceCallsDate = today;
      recoveryCase.voiceCallsToday = 0;
    }
    recoveryCase.voiceCallsToday++;
  }

  // Handle scheduling logic
  if (decision.action === "schedule_voice_recovery") {
    // Schedule for 2 minutes from now (demo-friendly)
    recoveryCase.scheduledFor = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    recoveryCase.totalAttempts++; // Count the scheduling as an attempt
  }

  // Set nextAttemptAt from decision if provided
  if (decision.nextAttemptAt) {
    recoveryCase.nextAttemptAt = decision.nextAttemptAt;
  }

  // Record the action
  const actionRecord: RecoveryAction = {
    id: store.nextActionId(),
    caseId,
    actionType: decision.action,
    actionReason: decision.reason,
    status: result.success ? "success" : (result.result === "awaiting_retry" ? "pending" : "failed"),
    result: JSON.stringify(result),
    amountRecovered: result.amountRecovered,
    executionTimeMs: result.executionTimeMs,
    isSimulated: true,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  store.actions.set(actionRecord.id, actionRecord);

  // Step 6: OBSERVE RESULT
  if (result.result === "recovered") {
    recoveryCase.state = "RECOVERED";
    recoveryCase.amountRecovered = result.amountRecovered;
    recoveryCase.recoveryChannel = decision.action.replace(/_/g, " ");
    recoveryCase.recoveryTimeMs = Date.now() - new Date(recoveryCase.createdAt).getTime();
    recoveryCase.resolvedAt = new Date().toISOString();

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `✓ Payment recovered: ₹${result.amountRecovered.toLocaleString("en-IN")} via ${decision.action.replace(/_/g, " ")}`,
      type: "recovery",
      amountRecovered: result.amountRecovered,
    });
  } else if (result.result === "stopped") {
    recoveryCase.state = "STOPPED";
    recoveryCase.resolvedAt = new Date().toISOString();

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Recovery stopped: ${result.details}`,
      type: "stop",
    });
  } else if (result.result === "escalated") {
    recoveryCase.state = "ESCALATED";
    recoveryCase.resolvedAt = new Date().toISOString();

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Case escalated for human intervention: ${result.details}`,
      type: "stop",
    });
  } else if (result.result === "awaiting_retry") {
    if (decision.action === "delayed_retry") {
      recoveryCase.state = "DELAYED_RETRY_SCHEDULED";
    } else if (decision.action === "schedule_voice_recovery") {
      recoveryCase.state = "VOICE_SCHEDULED";
    } else {
      recoveryCase.state = "WAITING_FOR_RESULT";
    }
    
    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Scheduled: ${result.details}`,
      type: "result",
    });
  } else {
    // Failed — set state to FAILED so campaign scheduler can pick it up for next attempt
    recoveryCase.state = "FAILED";
    
    // Set intelligent retry delay based on failure type
    const delayMs = getRetryDelay(event.failureReason, recoveryCase.totalAttempts);
    recoveryCase.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Action failed: ${result.details}. Retry scheduled in ${Math.round(delayMs / 60000)} min.`,
      type: "result",
    });
  }

  // Check if we hit max attempts after this execution
  if (recoveryCase.totalAttempts >= MAX_ATTEMPTS && !["RECOVERED", "STOPPED", "ESCALATED"].includes(recoveryCase.state)) {
    recoveryCase.state = "ESCALATED";
    recoveryCase.resolvedAt = new Date().toISOString();
    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Escalated: Maximum ${MAX_ATTEMPTS} automated attempts reached. Human intervention required.`,
      type: "stop",
    });
    recordAuditEvent({
      eventId: event.id,
      caseId,
      decision: "max_attempts_escalation",
      reason: `All ${MAX_ATTEMPTS} automated attempts exhausted. Further automated contact is prohibited by policy.`,
      amountAtRisk: event.amount,
      agentState: "ESCALATED",
    });
  }

  // Final audit
  recordAuditEvent({
    eventId: event.id,
    caseId,
    decision: recoveryCase.state === "RECOVERED" ? "recovery_complete" : recoveryCase.state.toLowerCase(),
    reason: result.details,
    recoveryProbability: scoreResult.score,
    action: decision.action,
    actionResult: result.result,
    amountAtRisk: event.amount,
    amountRecovered: recoveryCase.amountRecovered,
    agentState: recoveryCase.state,
  });

  recoveryCase.updatedAt = new Date().toISOString();
  return recoveryCase;
}

// ─── Retry Delay Logic ──────────────────────────────────────
function getRetryDelay(failureReason: string, attemptNum: number): number {
  // Demo-friendly delays (compressed for hackathon)
  if (TRANSIENT_FAILURES.has(failureReason)) {
    return attemptNum <= 1 ? 30 * 1000 : 2 * 60 * 1000; // 30s then 2min
  }
  if (failureReason === "insufficient_funds") {
    return attemptNum <= 1 ? 60 * 1000 : 5 * 60 * 1000; // 1min then 5min
  }
  if (failureReason === "authentication_failure") {
    return 3 * 60 * 1000; // 3min
  }
  // Default
  return 2 * 60 * 1000;
}

// ─── Process Batch ──────────────────────────────────────────

export async function processBatchAsync(batchId: string, caseIds: string[]): Promise<void> {
  const store = getStore();
  const batch = store.batches.get(batchId);
  if (!batch) return;

  batch.status = "processing";
  batch.startedAt = new Date().toISOString();

  for (const caseId of caseIds) {
    try {
      const result = processRecoveryCase(caseId);

      batch.processedCases++;

      if (result.state === "RECOVERED") {
        batch.recoveredCases++;
        batch.totalRecovered += result.amountRecovered;
      } else if (result.state === "STOPPED") {
        batch.stoppedCases++;
      } else if (result.state === "ESCALATED") {
        batch.escalatedCases++;
      } else if (result.state === "FAILED") {
        batch.failedCases++;
      }
    } catch (e) {
      batch.processedCases++;
      batch.failedCases++;
    }

    // Yield the event loop to allow UI to poll and simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  batch.status = "completed";
  batch.completedAt = new Date().toISOString();
}
