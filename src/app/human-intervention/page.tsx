"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Brain,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import type { RecoveryCase, RecoveryAction, AuditEntry } from "@/lib/types";

interface EnrichedCase extends RecoveryCase {
  customer?: { name: string; email: string; phone: string; preferredLanguage: string };
  event?: { failureReason: string; amount: number; eventType: string };
}

function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${amount.toLocaleString("en-IN")}`;
  return `₹${amount}`;
}

const resolutionOptions = [
  { value: "recovered_manually", label: "Recovered manually", color: "text-emerald-400" },
  { value: "payment_no_longer_required", label: "Payment no longer required", color: "text-blue-400" },
  { value: "customer_declined_permanently", label: "Customer declined permanently", color: "text-red-400" },
  { value: "unable_to_recover", label: "Unable to recover", color: "text-gray-400" },
  { value: "other", label: "Other", color: "text-[var(--color-text-muted)]" },
];

export default function HumanInterventionPage() {
  const [cases, setCases] = useState<EnrichedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [caseActions, setCaseActions] = useState<Record<string, RecoveryAction[]>>({});
  const [caseAudit, setCaseAudit] = useState<Record<string, AuditEntry[]>>({});
  // Resolve modal
  const [resolveCase, setResolveCase] = useState<EnrichedCase | null>(null);
  const [resolution, setResolution] = useState("recovered_manually");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      const [escalatedRes, humanRes] = await Promise.all([
        fetch("/api/cases?state=ESCALATED&limit=100"),
        fetch("/api/cases?state=HUMAN_CONTROLLED&limit=100"),
      ]);
      const escalatedData = await escalatedRes.json();
      const humanData = await humanRes.json();
      const allCases = [...(escalatedData.cases || []), ...(humanData.cases || [])];
      setCases(allCases);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 3000);
    return () => clearInterval(interval);
  }, [fetchCases]);

  const handleExpand = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      return;
    }
    setExpandedCase(caseId);
    // Fetch case detail
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      const data = await res.json();
      setCaseActions(prev => ({ ...prev, [caseId]: data.actions || [] }));
      setCaseAudit(prev => ({ ...prev, [caseId]: data.auditEntries || [] }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTakeOver = async (caseId: string) => {
    try {
      await fetch(`/api/cases/${caseId}/takeover`, { method: "POST" });
      fetchCases();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async () => {
    if (!resolveCase) return;
    setSubmitting(true);
    try {
      await fetch(`/api/cases/${resolveCase.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, note }),
      });
      setResolveCase(null);
      setResolution("recovered_manually");
      setNote("");
      fetchCases();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAtRisk = cases.reduce((sum, c) => sum + c.amountAtRisk, 0);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 fade-in min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400" />
          Human Intervention Required
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          {cases.length} cases · {formatINR(totalAtRisk)} at risk
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : cases.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold mb-2">No Intervention Required</h3>
          <p className="text-sm text-[var(--color-text-muted)]">All cases are being handled by the AI agent.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map(c => (
            <div key={c.id} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <Link href={`/cases/${c.id}`} className="text-base font-semibold hover:text-cyan-400 transition-colors">
                        {c.customer?.name || "Customer"}
                      </Link>
                      <p className="text-lg font-bold text-amber-400 mt-0.5">{formatINR(c.event?.amount || 0)}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                        <span>Attempts: {c.totalAttempts} / 3</span>
                        <span>Failure: {c.event?.failureReason.replace(/_/g, " ")}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          c.state === "HUMAN_CONTROLLED" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {c.state === "HUMAN_CONTROLLED" ? "HUMAN CONTROLLED" : "ESCALATED"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.state === "ESCALATED" && (
                      <button
                        onClick={() => handleTakeOver(c.id)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Take Over
                      </button>
                    )}
                    <button
                      onClick={() => { setResolveCase(c); setResolution("recovered_manually"); setNote(""); }}
                      className="px-4 py-2 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] text-emerald-400 text-xs font-semibold rounded-lg border border-[var(--color-border)] transition-colors"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleExpand(c.id)}
                      className="p-2 hover:bg-[var(--color-bg-card)] rounded-lg transition-colors"
                    >
                      {expandedCase === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Why AI Stopped */}
                <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                  <p className="text-[10px] uppercase font-semibold text-red-400 mb-1">Why Did AI Stop?</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {c.actionReason || `Further automated contact is prohibited by the 3-attempt policy. Manual outreach is recommended.`}
                  </p>
                </div>
              </div>

              {/* Expanded: Recovery Timeline */}
              {expandedCase === c.id && (
                <div className="border-t border-[var(--color-border)] p-5 bg-[var(--color-bg-primary)]/50 slide-up">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Recovery Timeline
                  </h4>
                  <div className="space-y-3">
                    {(caseActions[c.id] || []).map((action, i) => (
                      <div key={action.id} className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                          action.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium">{action.actionType.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">{action.actionReason}</p>
                          {action.result && (
                            <p className={`text-[10px] mt-0.5 ${action.status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                              Result: {action.status}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {(caseActions[c.id] || []).length === 0 && (
                      <p className="text-xs text-[var(--color-text-muted)]">Loading timeline...</p>
                    )}
                  </div>

                  {/* Agent Conclusion */}
                  <div className="mt-4 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                    <div className="flex items-start gap-2">
                      <Brain className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-[var(--color-text-secondary)] italic">
                        &ldquo;Further automated contact is prohibited by the 3-attempt policy. 
                        {c.totalAttempts >= 3 ? ` All ${c.totalAttempts} automated attempts exhausted.` : ""} 
                        Manual outreach is recommended for {c.customer?.name}.&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in">
          <div className="glass-card p-6 w-[480px] max-w-[90vw] slide-up">
            <h3 className="text-lg font-bold mb-1">Resolve Case</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {resolveCase.customer?.name} · {formatINR(resolveCase.event?.amount || 0)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase block mb-2">Resolution</label>
                <div className="space-y-2">
                  {resolutionOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResolution(opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        resolution === opt.value
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]"
                      }`}
                    >
                      {resolution === opt.value ? "● " : "○ "}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase block mb-2">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Payment completed through manual outreach."
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-[var(--color-text-muted)] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setResolveCase(null)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all disabled:opacity-50"
              >
                {submitting ? "Resolving..." : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
