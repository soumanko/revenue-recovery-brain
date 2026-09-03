// ─── Currency Formatting ─────────────────────────────────────

export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
  return `₹${amount}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── State Labels ────────────────────────────────────────────

export const stateLabels: Record<string, string> = {
  DETECTED: "Detected",
  DIAGNOSING: "Diagnosing",
  ACTION_SELECTED: "Action Selected",
  ACTION_EXECUTING: "Executing",
  WAITING_FOR_RESULT: "Awaiting Result",
  RECOVERED: "Recovered",
  FAILED: "Failed",
  STOPPED: "Stopped",
  ESCALATED: "Escalated",
};

export const stateColors: Record<string, string> = {
  DETECTED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DIAGNOSING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  ACTION_SELECTED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ACTION_EXECUTING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  WAITING_FOR_RESULT: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  RECOVERED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
  STOPPED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  ESCALATED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export const eventTypeLabels: Record<string, string> = {
  payment_failure: "Payment Failure",
  checkout_abandonment: "Checkout Abandonment",
  subscription_failure: "Subscription Failure",
};

export const actionLabels: Record<string, string> = {
  immediate_retry: "Immediate Retry",
  delayed_retry: "Delayed Retry",
  customer_notification: "Customer Notification",
  hinglish_voice_call: "Hinglish Voice Call",
  escalation: "Escalation",
  stop_recovery: "Stop Recovery",
};
