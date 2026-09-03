"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileSearch,
  ChevronRight,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import type { RecoveryCase, RevenueRiskEvent, Customer } from "@/lib/types";

const stateLabels: Record<string, string> = {
  DETECTED: "Detected", DIAGNOSING: "Diagnosing", ACTION_SELECTED: "Action Selected",
  ACTION_EXECUTING: "Executing", WAITING_FOR_RESULT: "Awaiting", RECOVERED: "Recovered",
  FAILED: "Failed", STOPPED: "Stopped", ESCALATED: "Escalated",
};

const stateColors: Record<string, string> = {
  DETECTED: "bg-blue-500/20 text-blue-400", DIAGNOSING: "bg-yellow-500/20 text-yellow-400",
  ACTION_SELECTED: "bg-purple-500/20 text-purple-400", ACTION_EXECUTING: "bg-orange-500/20 text-orange-400",
  WAITING_FOR_RESULT: "bg-cyan-500/20 text-cyan-400", RECOVERED: "bg-emerald-500/20 text-emerald-400",
  FAILED: "bg-red-500/20 text-red-400", STOPPED: "bg-gray-500/20 text-gray-400",
  ESCALATED: "bg-amber-500/20 text-amber-400",
};

const eventTypeLabels: Record<string, string> = {
  payment_failure: "Payment Failure", checkout_abandonment: "Checkout Abandonment",
  subscription_failure: "Subscription Failure",
};

function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

type EnrichedCase = RecoveryCase & { event?: RevenueRiskEvent; customer?: Customer };

export default function CasesPage() {
  const [cases, setCases] = useState<EnrichedCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));

      const res = await fetch(`/api/cases?${params}`);
      const data = await res.json();
      setCases(data.cases || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, eventTypeFilter, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recovery Cases</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{total} cases tracked</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(0); }}
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-emerald-500/50"
          >
            <option value="">All States</option>
            {Object.entries(stateLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <select
          value={eventTypeFilter}
          onChange={(e) => { setEventTypeFilter(e.target.value); setPage(0); }}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-emerald-500/50"
        >
          <option value="">All Event Types</option>
          {Object.entries(eventTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center">
            <FileSearch className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--color-text-muted)]">No cases found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Case</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Event Type</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">
                  <span className="flex items-center gap-1">Amount <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Score</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">State</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Recovered</th>
                <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">{c.id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-[var(--color-text-primary)]">{c.customer?.name || "—"}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.customer?.email || ""}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs">{eventTypeLabels[c.event?.eventType || ""] || c.event?.eventType}</span>
                    {c.event?.failureReason && c.event.failureReason !== "abandoned" && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">{c.event.failureReason.replace(/_/g, " ")}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-amber-400">
                    ₹{c.amountAtRisk.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    {c.recoveryScore !== undefined && c.recoveryScore !== null ? (
                      <span className={`font-semibold ${c.recoveryScore >= 70 ? "text-emerald-400" : c.recoveryScore >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                        {c.recoveryScore}%
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${stateColors[c.state] || ""} border-transparent`}>
                      {stateLabels[c.state] || c.state}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {c.amountRecovered > 0 ? (
                      <span className="font-semibold text-emerald-400">
                        ₹{c.amountRecovered.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/cases/${c.id}`}
                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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
    </div>
  );
}
