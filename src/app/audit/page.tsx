"use client";

import { useState, useEffect } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import type { AuditEntry } from "@/lib/types";

function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/audit?limit=${pageSize}&offset=${page * pageSize}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Complete log of every agent decision and action • {total} entries
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--color-text-muted)]">No audit entries yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Run a recovery batch to generate audit trail</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="space-y-px">
            {entries.map((entry) => (
              <div key={entry.id} className="border-b border-[var(--color-border)]/50">
                <button
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-card-hover)] transition-colors text-left"
                >
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-20 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)] w-24 shrink-0">
                    {entry.eventId}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded w-28 text-center shrink-0 ${
                    entry.decision === "recovery_complete"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : entry.decision === "stopped" || entry.decision === "stop_recovery"
                        ? "bg-gray-500/20 text-gray-400"
                        : "bg-cyan-500/20 text-cyan-400"
                  }`}>
                    {entry.decision}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
                    {entry.reason}
                  </span>
                  {entry.recoveryProbability !== undefined && entry.recoveryProbability !== null && (
                    <span className={`text-xs font-medium w-12 text-right shrink-0 ${
                      entry.recoveryProbability >= 70 ? "text-emerald-400" :
                      entry.recoveryProbability >= 40 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {entry.recoveryProbability}%
                    </span>
                  )}
                  {entry.amountRecovered !== undefined && entry.amountRecovered > 0 && (
                    <span className="text-xs font-semibold text-emerald-400 w-20 text-right shrink-0">
                      {formatINR(entry.amountRecovered)}
                    </span>
                  )}
                  {expanded === entry.id ? (
                    <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  )}
                </button>

                {expanded === entry.id && (
                  <div className="px-4 py-3 bg-[var(--color-bg-primary)] text-xs space-y-2 slide-up">
                    <pre className="bg-[var(--color-bg-secondary)] rounded-xl p-4 overflow-x-auto text-[var(--color-text-secondary)] font-mono text-[11px] leading-relaxed">
{JSON.stringify(
  {
    id: entry.id,
    eventId: entry.eventId,
    caseId: entry.caseId,
    timestamp: entry.timestamp,
    decision: entry.decision,
    reason: entry.reason,
    recoveryProbability: entry.recoveryProbability,
    policy: entry.policy,
    action: entry.action,
    actionResult: entry.actionResult,
    amountAtRisk: entry.amountAtRisk,
    amountRecovered: entry.amountRecovered,
    agentState: entry.agentState,
  },
  null,
  2
)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)]">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded-lg text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= total}
                  className="px-3 py-1 rounded-lg text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
