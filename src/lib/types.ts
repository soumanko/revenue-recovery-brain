// ─── Core Types ──────────────────────────────────────────────

export type EventType = "payment_failure" | "checkout_abandonment" | "subscription_failure";

export type FailureReason =
  | "insufficient_funds"
  | "bank_timeout"
  | "authentication_failure"
  | "card_declined"
  | "temporary_gateway_failure"
  | "card_expired"
  | "network_error"
  | "abandoned"
  | "unknown";

export type RecoveryState =
  | "DETECTED"
  | "DIAGNOSING"
  | "ACTION_SELECTED"
  | "ACTION_EXECUTING"
  | "WAITING_FOR_RESULT"
  | "DELAYED_RETRY_SCHEDULED"
  | "RECOVERED"
  | "FAILED"
  | "STOPPED"
  | "ESCALATED";

export type Recoverability =
  | "highly_recoverable"
  | "potentially_recoverable"
  | "unlikely"
  | "permanently_unrecoverable";

export type ActionType =
  | "immediate_retry"
  | "delayed_retry"
  | "customer_notification"
  | "hinglish_voice_call"
  | "escalation"
  | "stop_recovery";

export type ActionStatus = "pending" | "executing" | "success" | "failed" | "skipped";

export type ActivityType = "detection" | "diagnosis" | "scoring" | "action" | "result" | "recovery" | "stop";

// ─── Data Models ─────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  successfulPayments: number;
  failedPayments: number;
  averageOrderValue: number;
  totalSpent: number;
  preferredLanguage: string;
  createdAt: string;
}

export interface RevenueRiskEvent {
  id: string;
  eventType: EventType;
  customerId: string;
  amount: number;
  currency: string;
  failureReason: FailureReason;
  orderId: string;
  subscriptionId?: string;
  cartItems?: string;
  retryCount: number;
  previousSuccessfulPayments: number;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCase {
  id: string;
  eventId: string;
  customerId: string;
  batchId?: string;
  state: RecoveryState;
  recoveryScore?: number;
  recoverability?: Recoverability;
  diagnosis?: string;
  selectedAction?: ActionType;
  actionReason?: string;
  totalAttempts: number;
  customerContacts: number;
  amountAtRisk: number;
  amountRecovered: number;
  recoveryChannel?: string;
  recoveryTimeMs?: number;
  scoreBreakdown?: string;
  isSimulated: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface RecoveryAction {
  id: string;
  caseId: string;
  actionType: ActionType;
  actionReason: string;
  status: ActionStatus;
  result?: string;
  amountRecovered: number;
  executionTimeMs?: number;
  isSimulated: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface AuditEntry {
  id: string;
  eventId: string;
  caseId?: string;
  timestamp: string;
  decision: string;
  reason: string;
  recoveryProbability?: number;
  policy?: string;
  action?: string;
  actionResult?: string;
  amountAtRisk?: number;
  amountRecovered?: number;
  agentState?: string;
  scoreBreakdown?: string;
  policySnapshot?: string;
  metadata?: string;
}

export interface MerchantPolicy {
  id: string;
  maxRetries: number;
  maxCustomerContacts: number;
  recoveryWindowHours: number;
  minRecoveryProbabilityForRetry: number;
  minAmountForVoiceRecovery: number;
  enableVoiceRecovery: boolean;
  enableAutoRetry: boolean;
  updatedAt: string;
}

export interface BatchRun {
  id: string;
  totalCases: number;
  processedCases: number;
  recoveredCases: number;
  failedCases: number;
  stoppedCases: number;
  escalatedCases: number;
  totalAtRisk: number;
  totalRecovered: number;
  status: "pending" | "processing" | "completed";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: string;
  caseId?: string;
  eventId?: string;
  message: string;
  type: ActivityType;
  amountRecovered?: number;
  metadata?: string;
  createdAt: string;
}

// ─── Dashboard Types ─────────────────────────────────────────

export interface DashboardMetrics {
  revenueAtRisk: number;
  revenueRecovered: number;
  recoveryRate: number;
  activeCases: number;
  successfulRecoveries: number;
  stoppedCases: number;
  escalatedCases: number;
  averageRecoveryTimeMs: number;
  totalEvents: number;
}

export interface AnalyticsData {
  byEventType: { type: string; atRisk: number; recovered: number; count: number }[];
  byIntervention: { intervention: string; recovered: number; count: number }[];
  byFailureReason: { reason: string; atRisk: number; recovered: number; rate: number; count: number }[];
  recoveryTimeline: { date: string; recovered: number; atRisk: number }[];
}

// ─── Agent Types ─────────────────────────────────────────────

export interface DiagnosisResult {
  failureType: string;
  isTransient: boolean;
  recoverability: Recoverability;
  factors: string[];
  summary: string;
}

export interface RecoveryScoreResult {
  score: number;
  factors: { name: string; weight: number; value: number; contribution: number }[];
  reasoning: string;
}

export interface ActionDecision {
  action: ActionType;
  reason: string;
  confidence: number;
  alternativeActions: { action: ActionType; reason: string }[];
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason: string;
  violations: string[];
  policySnapshot: string;
}

export interface ExecutionResult {
  success: boolean;
  action: ActionType;
  result: "recovered" | "failed" | "awaiting_retry" | "escalated" | "stopped";
  amountRecovered: number;
  details: string;
  isSimulated: boolean;
  executionTimeMs: number;
}

// ─── Voice Types ─────────────────────────────────────────────

export interface VoiceMessage {
  speaker: "agent" | "customer";
  text: string;
  timestamp: string;
  isHinglish: boolean;
}

export interface VoiceSession {
  caseId: string;
  customerId: string;
  customerName: string;
  amount: number;
  failureReason: string;
  recoveryScore: number;
  state: "initiating" | "ringing" | "connected" | "speaking" | "listening" | "processing" | "completed" | "failed";
  transcript: VoiceMessage[];
  startedAt: string;
  duration: number;
  result?: "recovered" | "declined" | "no_answer" | "failed";
}
