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
import { getStore } from "./store";
import { v4 as uuidv4 } from "uuid";

// ─── Transient failure types ─────────────────────────────────
const TRANSIENT_FAILURES = new Set(["bank_timeout", "temporary_gateway_failure", "network_error"]);

// ─── Tool 1: Analyze Revenue Risk ───────────────────────────

export function analyzeRevenueRisk(event: RevenueRiskEvent): DiagnosisResult {
  const isTransient = TRANSIENT_FAILURES.has(event.failureReason);
  const factors: string[] = [];

  // Analyze failure type
  if (isTransient) {
    factors.push(`Failure type "${event.failureReason}" is transient and often resolves on retry`);
  } else if (event.failureReason === "insufficient_funds") {
    factors.push("Insufficient funds may resolve after a delay");
  } else if (event.failureReason === "card_expired") {
    factors.push("Card expired — requires customer action to update payment method");
  } else if (event.failureReason === "card_declined") {
    factors.push("Card declined — may be permanent block by issuing bank");
  } else if (event.failureReason === "authentication_failure") {
    factors.push("Authentication failure — customer may need to retry with correct credentials");
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
  } else if (event.failureReason === "insufficient_funds" || event.eventType === "checkout_abandonment") {
    recoverability = "potentially_recoverable";
  } else if (event.failureReason === "card_expired" || event.failureReason === "authentication_failure") {
    recoverability = "unlikely";
  } else {
    recoverability = "permanently_unrecoverable";
  }

  // Override if too many retries
  if (event.retryCount >= 2) {
    recoverability = "unlikely";
    factors.push(`Already attempted ${event.retryCount} retries without success`);
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
  if (event.eventType === "checkout_abandonment") {
    return `Customer abandoned checkout for ₹${event.amount.toLocaleString("en-IN")} order. A timely reminder may bring them back.`;
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
  const transienceScore = diagnosis.isTransient ? 95 : (event.failureReason === "insufficient_funds" ? 50 : (event.failureReason === "card_expired" ? 20 : 15));
  factors.push({ name: "Failure Transience", weight: 0.30, value: transienceScore, contribution: transienceScore * 0.30 });

  // Factor 2: Customer history (weight: 25%)
  const successRate = customer.totalOrders > 0 ? (customer.successfulPayments / customer.totalOrders) * 100 : 50;
  factors.push({ name: "Customer History", weight: 0.25, value: Math.round(successRate), contribution: successRate * 0.25 });

  // Factor 3: Retry count (weight: 15%)
  const retryPenalty = Math.max(0, 100 - event.retryCount * 40);
  factors.push({ name: "Retry Freshness", weight: 0.15, value: retryPenalty, contribution: retryPenalty * 0.15 });

  // Factor 4: Time since failure (weight: 10%)
  const hoursSinceFailure = (Date.now() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60);
  const timeScore = Math.max(0, 100 - hoursSinceFailure * 3);
  factors.push({ name: "Time Freshness", weight: 0.10, value: Math.round(timeScore), contribution: timeScore * 0.10 });

  // Factor 5: Transaction value relevance (weight: 10%)
  const valueScore = Math.min(100, (event.amount / 5000) * 60 + 40);
  factors.push({ name: "Transaction Value", weight: 0.10, value: Math.round(valueScore), contribution: valueScore * 0.10 });

  // Factor 6: Customer loyalty (weight: 10%)
  const loyaltyScore = Math.min(100, customer.totalOrders * 8 + (customer.totalSpent > 50000 ? 20 : 0));
  factors.push({ name: "Customer Loyalty", weight: 0.10, value: Math.round(loyaltyScore), contribution: loyaltyScore * 0.10 });

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

  if (["immediate_retry", "delayed_retry"].includes(action)) {
    if (!policy.enableAutoRetry) {
      violations.push("Auto retry is disabled by merchant policy.");
    }
    if (recoveryCase.totalAttempts >= policy.maxRetries) {
      violations.push(`Max retries (${policy.maxRetries}) reached.`);
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
    if (customer.preferredLanguage !== "hinglish") {
      violations.push("Customer language preference is not Hinglish.");
    }
    if (score < 50) {
      violations.push(`Score ${score}% is too low for voice recovery (min 50%).`);
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
  const alternativeActions: ActionDecision["alternativeActions"] = [];

  // 1. Hard Stops First
  if (diagnosis.recoverability === "permanently_unrecoverable") {
    return {
      action: "stop_recovery",
      reason: `Failure "${event.failureReason}" is permanently unrecoverable.`,
      confidence: 100,
      alternativeActions: [{ action: "escalation", reason: "Manual review" }],
    };
  }

  const hoursSinceDetection = (Date.now() - new Date(recoveryCase.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceDetection > policy.recoveryWindowHours) {
    return {
      action: "stop_recovery",
      reason: `Recovery window of ${policy.recoveryWindowHours} hours has expired.`,
      confidence: 100,
      alternativeActions: [],
    };
  }

  // 2. High-value Voice Recovery (if allowed)
  const voiceCheck = evaluatePolicy(recoveryCase, event, "schedule_voice_recovery", score, customer, policy);
  if (voiceCheck.allowed) {
    if (recoveryCase.totalAttempts > 0 || event.failureReason === "insufficient_funds" || diagnosis.isTransient) {
      return {
        action: "schedule_voice_recovery",
        reason: `Voice recovery is appropriate for high-value cart (₹${event.amount.toLocaleString("en-IN")}) with ${score}% probability.`,
        confidence: score,
        alternativeActions: [],
      };
    }
  }

  // 3. Transient & High Score -> Immediate Retry (if allowed)
  const immediateRetryCheck = evaluatePolicy(recoveryCase, event, "immediate_retry", score, customer, policy);
  if (diagnosis.isTransient && immediateRetryCheck.allowed) {
    return {
      action: "immediate_retry",
      reason: `${event.failureReason.replace(/_/g, " ")} is transient. High probability retry permitted.`,
      confidence: score,
      alternativeActions: [],
    };
  }

  // 4. Checkout Abandonment -> Notification (if allowed)
  const notifyCheck = evaluatePolicy(recoveryCase, event, "customer_notification", score, customer, policy);
  if (event.eventType === "checkout_abandonment" && notifyCheck.allowed) {
    return {
      action: "customer_notification",
      reason: `Customer abandoned checkout for ₹${event.amount.toLocaleString("en-IN")}. Sending recovery notification.`,
      confidence: Math.min(score + 10, 100),
      alternativeActions: [],
    };
  }

  // 5. Moderate Score -> Delayed Retry (if allowed)
  const delayedRetryCheck = evaluatePolicy(recoveryCase, event, "delayed_retry", score, customer, policy);
  if (score >= 40 && delayedRetryCheck.allowed) {
    return {
      action: "delayed_retry",
      reason: `Moderate probability (${score}%). Scheduling delayed retry to allow conditions to improve.`,
      confidence: score,
      nextAttemptAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      delayReason: "Waiting 4 hours for customer funds to replenish or temporary issue to resolve.",
      alternativeActions: [],
    };
  }

  // 6. Fallback -> Notification (if still allowed)
  if (notifyCheck.allowed) {
    return {
      action: "customer_notification",
      reason: `Retry unlikely to succeed (${score}%). Sending customer notification as fallback.`,
      confidence: score,
      alternativeActions: [],
    };
  }

  // 7. Escalation (if exhausted but score is somewhat decent)
  if (score >= 20) {
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
  const startTime = Date.now();

  switch (action) {
    case "delayed_retry": {
      return {
        success: false,
        action,
        result: "awaiting_retry",
        amountRecovered: 0,
        details: `Payment retry scheduled for later.`,
        isSimulated: true,
        executionTimeMs: 100,
      };
    }
    case "immediate_retry": {
      // Simulate payment retry
      const success = simulatePaymentRetry(event, diagnosis);
      return {
        success,
        action,
        result: success ? "recovered" : "failed",
        amountRecovered: success ? event.amount : 0,
        details: success
          ? `Payment retry successful. ₹${event.amount.toLocaleString("en-IN")} recovered via ${action.replace(/_/g, " ")}.`
          : `Payment retry failed. ${event.failureReason.replace(/_/g, " ")} persists.`,
        isSimulated: true,
        executionTimeMs: Math.floor(Math.random() * 2000) + 500,
      };
    }

    case "customer_notification": {
      // Simulate notification — some customers respond
      const responded = Math.random() < 0.45;
      const recovered = responded && Math.random() < 0.7;
      return {
        success: recovered,
        action,
        result: recovered ? "recovered" : (responded ? "awaiting_retry" : "failed"),
        amountRecovered: recovered ? event.amount : 0,
        details: recovered
          ? `Customer responded to notification and completed payment. ₹${event.amount.toLocaleString("en-IN")} recovered.`
          : responded
            ? "Customer acknowledged notification but has not completed payment yet."
            : "Customer did not respond to recovery notification.",
        isSimulated: true,
        executionTimeMs: Math.floor(Math.random() * 3000) + 1000,
      };
    }

    case "schedule_voice_recovery": {
      return {
        success: false,
        action,
        result: "awaiting_retry",
        amountRecovered: 0,
        details: "Voice recovery scheduled for 1 hour from now.",
        isSimulated: true,
        executionTimeMs: 100,
      };
    }

    case "execute_voice_recovery":
    case "hinglish_voice_call": {
      // Simulate voice recovery — high success for eligible cases
      const success = Math.random() < 0.72;
      return {
        success,
        action,
        result: success ? "recovered" : "failed",
        amountRecovered: success ? event.amount : 0,
        details: success
          ? `Hinglish voice recovery successful. ${customer.name} agreed to retry payment. ₹${event.amount.toLocaleString("en-IN")} recovered.`
          : `Voice call completed but customer ${Math.random() < 0.5 ? "declined to retry" : "was unable to complete payment"}.`,
        isSimulated: true,
        executionTimeMs: Math.floor(Math.random() * 120000) + 30000, // 30s-150s for voice
      };
    }

    case "escalation": {
      return {
        success: false,
        action,
        result: "escalated",
        amountRecovered: 0,
        details: "Case escalated to manual review queue. Agent has exhausted automated recovery options.",
        isSimulated: true,
        executionTimeMs: Math.floor(Math.random() * 500) + 100,
      };
    }

    case "stop_recovery": {
      return {
        success: false,
        action,
        result: "stopped",
        amountRecovered: 0,
        details: "Recovery stopped per policy. No further actions will be taken.",
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

function simulatePaymentRetry(event: RevenueRiskEvent, diagnosis: DiagnosisResult): boolean {
  // Transient failures have high retry success
  if (diagnosis.isTransient) {
    return Math.random() < 0.78;
  }
  // Insufficient funds — moderate chance after delay
  if (event.failureReason === "insufficient_funds") {
    return Math.random() < 0.35;
  }
  // Other failures — low chance
  return Math.random() < 0.15;
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
  if (["RECOVERED", "STOPPED", "ESCALATED"].includes(recoveryCase.state)) {
    return recoveryCase;
  }

  // Step 1: DETECT (already done at creation)
  recordActivity({
    caseId,
    eventId: recoveryCase.eventId,
    message: `Detected ₹${event.amount.toLocaleString("en-IN")} ${event.eventType.replace(/_/g, " ")} risk`,
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
    message: `Diagnosing failure: ${event.failureReason.replace(/_/g, " ")}`,
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
    message: `Recovery probability calculated: ${scoreResult.score}%`,
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
    message: `Selected action: ${decision.action.replace(/_/g, " ")}`,
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
  }

  // Handle scheduling logic
  if (decision.action === "schedule_voice_recovery") {
    // Schedule for 1 hour from now
    recoveryCase.scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  // Record the action
  const actionRecord: RecoveryAction = {
    id: store.nextActionId(),
    caseId,
    actionType: decision.action,
    actionReason: decision.reason,
    status: result.success ? "success" : "failed",
    result: JSON.stringify(result),
    amountRecovered: result.amountRecovered,
    executionTimeMs: result.executionTimeMs,
    isSimulated: true,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  store.actions.set(actionRecord.id, actionRecord);

  // Step 6: OBSERVE
  recoveryCase.state = "WAITING_FOR_RESULT";

  if (result.result === "recovered") {
    recoveryCase.state = "RECOVERED";
    recoveryCase.amountRecovered = result.amountRecovered;
    recoveryCase.recoveryChannel = decision.action.replace(/_/g, " ");
    recoveryCase.recoveryTimeMs = Date.now() - new Date(recoveryCase.createdAt).getTime();
    recoveryCase.resolvedAt = new Date().toISOString();

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Payment recovered`,
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
      message: `Case escalated for manual review`,
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
      message: `Action scheduled or awaiting response: ${result.details}`,
      type: "result",
    });
  } else {
    // Failed — try next action if within policy
    recoveryCase.state = "FAILED";

    recordActivity({
      caseId,
      eventId: recoveryCase.eventId,
      message: `Action failed: ${result.details}`,
      type: "result",
    });

    // Step 7: Try a follow-up action (STOP or escalate if limits hit)
    const followUpDecision = selectRecoveryAction(event, customer, recoveryCase, scoreResult.score, diagnosis, policy);

    if (followUpDecision.action === "stop_recovery") {
      recoveryCase.state = "STOPPED";
      recoveryCase.resolvedAt = new Date().toISOString();
      recoveryCase.selectedAction = "stop_recovery";
      recoveryCase.actionReason = followUpDecision.reason;

      recordActivity({
        caseId,
        eventId: recoveryCase.eventId,
        message: `Recovery stopped per policy`,
        type: "stop",
      });
    } else if (followUpDecision.action !== decision.action) {
      // Execute follow-up action
      recoveryCase.selectedAction = followUpDecision.action;
      recoveryCase.actionReason = followUpDecision.reason;

      recordActivity({
        caseId,
        eventId: recoveryCase.eventId,
        message: `Trying follow-up: ${followUpDecision.action.replace(/_/g, " ")}`,
        type: "action",
      });

      if (["customer_notification", "hinglish_voice_call", "execute_voice_recovery"].includes(followUpDecision.action)) {
        recoveryCase.customerContacts++;
      }
      if (["immediate_retry", "delayed_retry"].includes(followUpDecision.action)) {
        recoveryCase.totalAttempts++;
        event.retryCount++;
      }

      const followUpResult = executeRecoveryAction(recoveryCase, event, followUpDecision.action, customer, diagnosis);

      const followUpAction: RecoveryAction = {
        id: store.nextActionId(),
        caseId,
        actionType: followUpDecision.action,
        actionReason: followUpDecision.reason,
        status: followUpResult.success ? "success" : "failed",
        result: JSON.stringify(followUpResult),
        amountRecovered: followUpResult.amountRecovered,
        executionTimeMs: followUpResult.executionTimeMs,
        isSimulated: true,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      store.actions.set(followUpAction.id, followUpAction);

      if (followUpResult.result === "recovered") {
        recoveryCase.state = "RECOVERED";
        recoveryCase.amountRecovered = followUpResult.amountRecovered;
        recoveryCase.recoveryChannel = followUpDecision.action.replace(/_/g, " ");
        recoveryCase.recoveryTimeMs = Date.now() - new Date(recoveryCase.createdAt).getTime();
        recoveryCase.resolvedAt = new Date().toISOString();

        recordActivity({
          caseId,
          eventId: recoveryCase.eventId,
          message: `Payment recovered via ${followUpDecision.action.replace(/_/g, " ")}`,
          type: "recovery",
          amountRecovered: followUpResult.amountRecovered,
        });
      } else {
        recoveryCase.state = "STOPPED";
        recoveryCase.resolvedAt = new Date().toISOString();

        recordActivity({
          caseId,
          eventId: recoveryCase.eventId,
          message: `All recovery attempts exhausted. Stopping.`,
          type: "stop",
        });
      }

      recordAuditEvent({
        eventId: event.id,
        caseId,
        decision: followUpDecision.action,
        reason: followUpDecision.reason,
        recoveryProbability: scoreResult.score,
        action: followUpDecision.action,
        actionResult: followUpResult.result,
        amountAtRisk: event.amount,
        amountRecovered: followUpResult.amountRecovered,
        agentState: recoveryCase.state,
      });
    } else {
      // Same action would be selected — stop to avoid loops
      recoveryCase.state = "STOPPED";
      recoveryCase.resolvedAt = new Date().toISOString();

      recordActivity({
        caseId,
        eventId: recoveryCase.eventId,
        message: `Recovery stopped — same action would repeat`,
        type: "stop",
      });
    }
  }

  // Handle Escalation after 3 failures
  if (recoveryCase.totalAttempts >= 3 && !["RECOVERED", "STOPPED", "ESCALATED"].includes(recoveryCase.state)) {
      recoveryCase.state = "ESCALATED";
      recoveryCase.resolvedAt = new Date().toISOString();
      recordActivity({
        caseId,
        eventId: recoveryCase.eventId,
        message: `Escalated: Max attempts (3) reached.`,
        type: "stop",
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
