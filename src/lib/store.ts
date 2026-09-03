import { v4 as uuidv4 } from "uuid";
import type {
  Customer,
  RevenueRiskEvent,
  RecoveryCase,
  RecoveryAction,
  AuditEntry,
  MerchantPolicy,
  BatchRun,
  ActivityFeedItem,
} from "./types";

// ─── In-Memory Data Store ────────────────────────────────────
// Uses a singleton pattern to persist data across API calls within the same server instance.

class DataStore {
  customers: Map<string, Customer> = new Map();
  events: Map<string, RevenueRiskEvent> = new Map();
  cases: Map<string, RecoveryCase> = new Map();
  actions: Map<string, RecoveryAction> = new Map();
  auditLog: AuditEntry[] = [];
  policy: MerchantPolicy;
  batches: Map<string, BatchRun> = new Map();
  activityFeed: ActivityFeedItem[] = [];

  private initialized = false;

  constructor() {
    this.policy = {
      id: "default",
      maxRetries: 2,
      maxCustomerContacts: 2,
      recoveryWindowHours: 48,
      minRecoveryProbabilityForRetry: 65,
      minAmountForVoiceRecovery: 2000,
      enableVoiceRecovery: true,
      enableAutoRetry: true,
      updatedAt: new Date().toISOString(),
    };
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    seedData(this);
  }

  reset() {
    this.customers.clear();
    this.events.clear();
    this.cases.clear();
    this.actions.clear();
    this.auditLog = [];
    this.batches.clear();
    this.activityFeed = [];
    this.initialized = false;
    this.init();
  }

  // Helper to generate IDs
  nextEventId(): string {
    return `EVT_${String(this.events.size + 1).padStart(4, "0")}`;
  }
  nextCaseId(): string {
    return `CASE_${String(this.cases.size + 1).padStart(4, "0")}`;
  }
  nextActionId(): string {
    return `ACT_${uuidv4().slice(0, 8)}`;
  }
}

// ─── Singleton ───────────────────────────────────────────────
let store: DataStore | null = null;

export function getStore(): DataStore {
  if (!store) {
    store = new DataStore();
    store.init();
  }
  return store;
}

// ─── Seed Data ───────────────────────────────────────────────

function seedData(db: DataStore) {
  const now = new Date();

  // ─── Seed Customers ─────────────────────────────────────
  const customerData: Omit<Customer, "id" | "createdAt">[] = [
    { name: "Rahul Sharma", email: "rahul@example.com", phone: "+91-98765-43210", totalOrders: 12, successfulPayments: 10, failedPayments: 2, averageOrderValue: 8500, totalSpent: 85000, preferredLanguage: "hinglish" },
    { name: "Priya Patel", email: "priya@example.com", phone: "+91-98765-43211", totalOrders: 8, successfulPayments: 7, failedPayments: 1, averageOrderValue: 6200, totalSpent: 43400, preferredLanguage: "hinglish" },
    { name: "Amit Kumar", email: "amit@example.com", phone: "+91-98765-43212", totalOrders: 15, successfulPayments: 14, failedPayments: 1, averageOrderValue: 3800, totalSpent: 53200, preferredLanguage: "hinglish" },
    { name: "Sneha Reddy", email: "sneha@example.com", phone: "+91-98765-43213", totalOrders: 3, successfulPayments: 2, failedPayments: 1, averageOrderValue: 22000, totalSpent: 44000, preferredLanguage: "english" },
    { name: "Vikram Singh", email: "vikram@example.com", phone: "+91-98765-43214", totalOrders: 20, successfulPayments: 18, failedPayments: 2, averageOrderValue: 4500, totalSpent: 81000, preferredLanguage: "hinglish" },
    { name: "Anita Desai", email: "anita@example.com", phone: "+91-98765-43215", totalOrders: 6, successfulPayments: 5, failedPayments: 1, averageOrderValue: 1800, totalSpent: 9000, preferredLanguage: "hinglish" },
    { name: "Raj Malhotra", email: "raj@example.com", phone: "+91-98765-43216", totalOrders: 10, successfulPayments: 8, failedPayments: 2, averageOrderValue: 9200, totalSpent: 73600, preferredLanguage: "hinglish" },
    { name: "Meera Iyer", email: "meera@example.com", phone: "+91-98765-43217", totalOrders: 25, successfulPayments: 24, failedPayments: 1, averageOrderValue: 5600, totalSpent: 134400, preferredLanguage: "english" },
    { name: "Arjun Nair", email: "arjun@example.com", phone: "+91-98765-43218", totalOrders: 4, successfulPayments: 3, failedPayments: 1, averageOrderValue: 12000, totalSpent: 36000, preferredLanguage: "hinglish" },
    { name: "Kavita Joshi", email: "kavita@example.com", phone: "+91-98765-43219", totalOrders: 7, successfulPayments: 6, failedPayments: 1, averageOrderValue: 7800, totalSpent: 46800, preferredLanguage: "hinglish" },
    { name: "Deepak Gupta", email: "deepak@example.com", phone: "+91-98765-43220", totalOrders: 30, successfulPayments: 28, failedPayments: 2, averageOrderValue: 3200, totalSpent: 89600, preferredLanguage: "hinglish" },
    { name: "Ritu Agarwal", email: "ritu@example.com", phone: "+91-98765-43221", totalOrders: 5, successfulPayments: 4, failedPayments: 1, averageOrderValue: 15000, totalSpent: 60000, preferredLanguage: "english" },
    { name: "Suresh Pillai", email: "suresh@example.com", phone: "+91-98765-43222", totalOrders: 18, successfulPayments: 16, failedPayments: 2, averageOrderValue: 2800, totalSpent: 44800, preferredLanguage: "hinglish" },
    { name: "Neha Kapoor", email: "neha@example.com", phone: "+91-98765-43223", totalOrders: 9, successfulPayments: 8, failedPayments: 1, averageOrderValue: 11500, totalSpent: 92000, preferredLanguage: "hinglish" },
    { name: "Mohan Rao", email: "mohan@example.com", phone: "+91-98765-43224", totalOrders: 2, successfulPayments: 1, failedPayments: 1, averageOrderValue: 35000, totalSpent: 35000, preferredLanguage: "english" },
    { name: "Sanjay Verma", email: "sanjay@example.com", phone: "+91-98765-43225", totalOrders: 14, successfulPayments: 12, failedPayments: 2, averageOrderValue: 4100, totalSpent: 49200, preferredLanguage: "hinglish" },
    { name: "Pooja Mishra", email: "pooja@example.com", phone: "+91-98765-43226", totalOrders: 11, successfulPayments: 10, failedPayments: 1, averageOrderValue: 6800, totalSpent: 68000, preferredLanguage: "hinglish" },
    { name: "Kiran Bhatt", email: "kiran@example.com", phone: "+91-98765-43227", totalOrders: 1, successfulPayments: 0, failedPayments: 1, averageOrderValue: 0, totalSpent: 0, preferredLanguage: "hinglish" },
    { name: "Ajay Tiwari", email: "ajay@example.com", phone: "+91-98765-43228", totalOrders: 22, successfulPayments: 20, failedPayments: 2, averageOrderValue: 5900, totalSpent: 118000, preferredLanguage: "hinglish" },
    { name: "Divya Menon", email: "divya@example.com", phone: "+91-98765-43229", totalOrders: 16, successfulPayments: 15, failedPayments: 1, averageOrderValue: 8100, totalSpent: 121500, preferredLanguage: "hinglish" },
  ];

  const customerIds: string[] = [];
  customerData.forEach((c, i) => {
    const id = `CUST_${String(i + 1).padStart(3, "0")}`;
    customerIds.push(id);
    db.customers.set(id, {
      ...c,
      id,
      createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  // ─── Seed Revenue Risk Events ───────────────────────────
  const failureReasons: Array<{ reason: RevenueRiskEvent["failureReason"]; isTransient: boolean }> = [
    { reason: "bank_timeout", isTransient: true },
    { reason: "temporary_gateway_failure", isTransient: true },
    { reason: "network_error", isTransient: true },
    { reason: "insufficient_funds", isTransient: false },
    { reason: "card_declined", isTransient: false },
    { reason: "authentication_failure", isTransient: false },
    { reason: "card_expired", isTransient: false },
  ];

  const eventTypes: Array<{ type: RevenueRiskEvent["eventType"]; weight: number }> = [
    { type: "payment_failure", weight: 0.6 },
    { type: "checkout_abandonment", weight: 0.25 },
    { type: "subscription_failure", weight: 0.15 },
  ];

  // Case A - Guaranteed Voice Success
  const caseA: RevenueRiskEvent = {
    id: db.nextEventId(),
    eventType: "payment_failure",
    customerId: customerIds[0], // Rahul (Hinglish, good history)
    amount: 12499,
    currency: "INR",
    failureReason: "bank_timeout", // Transient
    orderId: "ORD_A",
    retryCount: 0,
    previousSuccessfulPayments: 10,
    createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
  };

  // Case B - Successful automatic retry
  const caseB: RevenueRiskEvent = {
    id: db.nextEventId(),
    eventType: "payment_failure",
    customerId: customerIds[1], // Priya (Hinglish)
    amount: 1500,
    currency: "INR",
    failureReason: "temporary_gateway_failure", // Transient
    orderId: "ORD_B",
    retryCount: 0,
    previousSuccessfulPayments: 7,
    createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
  };

  // Case C - Retry failure then fallback success
  const caseC: RevenueRiskEvent = {
    id: db.nextEventId(),
    eventType: "payment_failure",
    customerId: customerIds[2], // Amit
    amount: 8500,
    currency: "INR",
    failureReason: "insufficient_funds",
    orderId: "ORD_C",
    retryCount: 0,
    previousSuccessfulPayments: 14,
    createdAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
  };

  // Case D - Hard Stop
  const caseD: RevenueRiskEvent = {
    id: db.nextEventId(),
    eventType: "payment_failure",
    customerId: customerIds[3], // Sneha
    amount: 45000,
    currency: "INR",
    failureReason: "card_declined", // Permanently unrecoverable
    orderId: "ORD_D",
    retryCount: 0,
    previousSuccessfulPayments: 2,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
  };

  // Case E - Policy stop (Max retries reached)
  const caseE: RevenueRiskEvent = {
    id: db.nextEventId(),
    eventType: "payment_failure",
    customerId: customerIds[4], // Vikram
    amount: 4500,
    currency: "INR",
    failureReason: "network_error",
    orderId: "ORD_E",
    retryCount: 3, // Over maxRetries (default 2)
    previousSuccessfulPayments: 18,
    createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
  };

  const allEvents: RevenueRiskEvent[] = [caseA, caseB, caseC, caseD, caseE];

  // Generate remaining random events
  const amounts = [499, 799, 999, 1299, 1499, 1999, 2499, 2999, 3499, 3999, 4499, 4999, 5999, 6999, 7999, 8999, 9999, 11999, 12999, 14999, 17999, 19999, 24999, 29999, 34999, 39999, 44999, 49999];

  for (let i = 0; i < 50; i++) {
    const id = db.nextEventId();
    const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];

    allEvents.push({
      id,
      eventType: eventType.type,
      customerId,
      amount,
      currency: "INR",
      failureReason: reason.reason,
      orderId: `ORD_${uuidv4().slice(0, 6)}`,
      retryCount: 0,
      previousSuccessfulPayments: db.customers.get(customerId)?.successfulPayments || 0,
      createdAt: new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Save all events and create cases
  allEvents.forEach((evt) => {
    db.events.set(evt.id, evt);
    const caseId = db.nextCaseId();
    db.cases.set(caseId, {
      id: caseId,
      eventId: evt.id,
      customerId: evt.customerId,
      state: "DETECTED",
      totalAttempts: evt.retryCount,
      customerContacts: 0,
      amountAtRisk: evt.amount,
      amountRecovered: 0,
      isSimulated: true,
      createdAt: evt.createdAt,
      updatedAt: evt.updatedAt,
    });
  });
}

export type { DataStore };
