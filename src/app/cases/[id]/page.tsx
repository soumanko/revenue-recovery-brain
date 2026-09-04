"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Brain,
  Zap,
  User,
  Shield,
} from "lucide-react";
import type {
  RecoveryCase,
  RevenueRiskEvent,
  Customer,
  RecoveryAction,
  AuditEntry,
  ActivityFeedItem,
  DiagnosisResult,
} from "@/lib/types";

const stateColors: Record<string, string> = {
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

const stateIcons: Record<string, typeof AlertCircle> = {
  DETECTED: AlertCircle, DIAGNOSING: Brain, ACTION_SELECTED: Activity,
  ACTION_EXECUTING: Zap, WAITING_FOR_RESULT: Clock, RECOVERED: CheckCircle2,
  FAILED: ExternalLink, STOPPED: ShieldAlert, ESCALATED: ShieldAlert,
};

const actionLabels: Record<string, string> = {
  immediate_retry: "Immediate Retry", delayed_retry: "Delayed Retry",
  customer_notification: "Customer Notification", hinglish_voice_call: "Hinglish Voice Call",
  escalation: "Escalation", stop_recovery: "Stop Recovery",
};

const eventTypeLabels: Record<string, string> = {
  payment_failure: "Payment Failure", checkout_abandonment: "Checkout Abandonment",
  subscription_failure: "Subscription Failure",
};

interface CaseDetailData {
  case: RecoveryCase;
  event: RevenueRiskEvent;
  customer: Customer;
  actions: RecoveryAction[];
  auditEntries: AuditEntry[];
  activities: ActivityFeedItem[];
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id }),
      });
      // Reload data
      const res = await fetch(`/api/cases/${id}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.case) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--color-text-muted)]">Case not found</p>
        <Link href="/cases" className="text-emerald-400 text-sm mt-2 inline-block">← Back to cases</Link>
      </div>
    );
  }

  const { case: rc, event, customer, actions, auditEntries, activities } = data;
  const diagnosis: DiagnosisResult | null = rc.diagnosis ? JSON.parse(rc.diagnosis) : null;
  const isResolved = ["RECOVERED", "STOPPED", "ESCALATED"].includes(rc.state);
  const StateIcon = stateIcons[rc.state] || AlertCircle;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/cases" className="p-2 rounded-xl hover:bg-[var(--color-bg-card)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{rc.id}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${stateColors[rc.state]}`}>
              <StateIcon className="w-3 h-3" />
              {rc.state}
            </span>
          </div>
          <p className="text-[var(--color-text-muted)] text-sm mt-0.5">
            {eventTypeLabels[event.eventType]} • {event.failureReason.replace(/_/g, " ")}
          </p>
        </div>
        {!isResolved && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all disabled:opacity-50"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Process Case
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue at Risk */}
          <div className="glass-card p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Revenue at Risk</p>
                <p className="text-3xl font-bold text-amber-400">₹{rc.amountAtRisk.toLocaleString("en-IN")}</p>
              </div>
              {rc.amountRecovered > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Recovered</p>
                  <p className="text-3xl font-bold text-emerald-400 recovery-glow">
                    ₹{rc.amountRecovered.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Diagnosis */}
          {diagnosis && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Agent Diagnosis
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{diagnosis.summary}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-primary)] rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Recoverability</p>
                  <p className={`text-sm font-semibold ${
                    diagnosis.recoverability === "highly_recoverable" ? "text-emerald-400" :
                    diagnosis.recoverability === "potentially_recoverable" ? "text-yellow-400" :
                    "text-red-400"
                  }`}>
                    {diagnosis.recoverability.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="bg-[var(--color-bg-primary)] rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Transient</p>
                  <p className="text-sm font-semibold">{diagnosis.isTransient ? "Yes" : "No"}</p>
                </div>
              </div>
              {diagnosis.factors.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">Diagnosis Factors</p>
                  <ul className="space-y-1">
                    {diagnosis.factors.map((f, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recovery Score */}
          {rc.recoveryScore !== undefined && rc.recoveryScore !== null && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" />
                Recovery Probability
              </h2>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={rc.recoveryScore >= 70 ? "#10b981" : rc.recoveryScore >= 40 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="8"
                      strokeDasharray={`${rc.recoveryScore * 2.64} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                    {rc.recoveryScore}%
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {rc.recoveryScore >= 70 ? "High probability of recovery" :
                     rc.recoveryScore >= 40 ? "Moderate recovery chance" :
                     "Low recovery probability"}
                  </p>
                </div>
              </div>
              
              {rc.scoreBreakdown && (
                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">Score Breakdown</p>
                  <div className="space-y-2">
                    {JSON.parse(rc.scoreBreakdown).map((factor: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-[var(--color-text-secondary)]">{factor.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-muted)] opacity-50 text-right w-12">
                            wt: {factor.weight}
                          </span>
                          <span className={`font-medium text-right w-12 ${factor.contribution >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {factor.contribution >= 0 ? "+" : ""}{factor.contribution}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Agent Decision */}
          {rc.selectedAction && (
            <div className="glass-card p-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Agent Decision
              </h2>
              <div className="bg-[var(--color-bg-primary)] rounded-xl p-4">
                <p className="text-sm font-semibold text-cyan-400 mb-1">
                  {actionLabels[rc.selectedAction] || rc.selectedAction}
                </p>
                {rc.actionReason && (
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed italic">
                    &ldquo;{rc.actionReason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          {activities.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recovery Timeline
              </h2>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-border)]" />
                <div className="space-y-4">
                  {activities.map((act, i) => (
                    <div key={act.id} className="relative flex gap-4 pl-4">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 z-10 ${
                        act.type === "recovery" ? "bg-emerald-400" :
                        act.type === "stop" ? "bg-gray-400" :
                        act.type === "detection" ? "bg-blue-400" :
                        act.type === "action" ? "bg-cyan-400" :
                        "bg-purple-400"
                      }`} />
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-[var(--color-text-secondary)]">{act.message}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {new Date(act.createdAt).toLocaleString("en-IN")}
                        </p>
                        {act.amountRecovered && act.amountRecovered > 0 && (
                          <p className="text-xs font-semibold text-emerald-400 mt-1">
                            ₹{act.amountRecovered.toLocaleString("en-IN")} recovered
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Customer Context */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Context
            </h2>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{customer.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{customer.email}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{customer.phone}</p>
            </div>
            <div className="space-y-2">
              {[
                { label: "Previous Successful Payments", value: customer.successfulPayments },
                { label: "Previous Failed Payments", value: customer.failedPayments },
                { label: "Total Orders", value: customer.totalOrders },
                { label: "Average Order Value", value: `₹${customer.averageOrderValue.toLocaleString("en-IN")}` },
                { label: "Lifetime Value (LTV)", value: `₹${customer.totalSpent.toLocaleString("en-IN")}` },
                { label: "Language", value: customer.preferredLanguage },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1 border-b border-[var(--color-border)]/50">
                  <span className="text-xs text-[var(--color-text-muted)]">{item.label}</span>
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Policy */}
          <div className="glass-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Policy Constraints
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Retry Attempts</span>
                <span>{rc.totalAttempts} / 2</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Customer Contacts</span>
                <span>{rc.customerContacts} / 2</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Recovery Window</span>
                <span>48 hours</span>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div className="glass-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Event Details</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Event ID</span>
                <span className="font-mono">{event.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Type</span>
                <span>{eventTypeLabels[event.eventType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Failure</span>
                <span>{event.failureReason.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Order</span>
                <span className="font-mono">{event.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Simulated</span>
                <span>{rc.isSimulated ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {/* Audit Entries */}
          {auditEntries.length > 0 && (
            <div className="glass-card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Audit Trail</h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-cyan-400">{entry.decision}</span>
                      <span className="text-[var(--color-text-muted)]">
                        {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">{entry.reason}</p>
                    {entry.amountRecovered !== undefined && entry.amountRecovered > 0 && (
                      <p className="font-semibold text-emerald-400">₹{entry.amountRecovered.toLocaleString("en-IN")} recovered</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
