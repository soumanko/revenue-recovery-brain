"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Clock,
  XCircle,
  ArrowUpRight,
  PlayCircle,
  RefreshCw,
  IndianRupee,
  Phone,
  Zap,
  ArrowRight,
} from "lucide-react";
import type { DashboardMetrics, ActivityFeedItem } from "@/lib/types";

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${amount.toLocaleString("en-IN")}`;
  return `₹${amount}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
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

const activityTypeIcons: Record<string, typeof Activity> = {
  detection: AlertTriangle,
  diagnosis: Activity,
  scoring: TrendingUp,
  action: Zap,
  result: ArrowRight,
  recovery: CheckCircle2,
  stop: XCircle,
};

const activityTypeColors: Record<string, string> = {
  detection: "text-blue-400",
  diagnosis: "text-yellow-400",
  scoring: "text-purple-400",
  action: "text-cyan-400",
  result: "text-orange-400",
  recovery: "text-emerald-400",
  stop: "text-gray-400",
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, feedRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/agent/activity?limit=20"),
      ]);
      const metricsData = await metricsRes.json();
      const feedData = await feedRes.json();
      setMetrics(metricsData);
      setFeed(feedData.feed || []);
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleReset = async () => {
    setResetting(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchData();
    setResetting(false);
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const hasProcessed = metrics.successfulRecoveries > 0 || metrics.stoppedCases > 0;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Recovery Dashboard</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            AI-powered autonomous recovery • {metrics.totalEvents} events tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`} />
            Reset Data
          </button>
          <Link
            href="/batch"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30"
          >
            <PlayCircle className="w-4 h-4" />
            Run Recovery Batch
          </Link>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue at Risk */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Revenue at Risk
            </span>
          </div>
          <p className="metric-value text-amber-400">{formatINR(metrics.revenueAtRisk)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Across {metrics.totalEvents} events
          </p>
        </div>

        {/* Revenue Recovered */}
        <div className="glass-card p-5 border-emerald-500/20">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Recovered
            </span>
          </div>
          <p className="metric-value text-emerald-400 recovery-glow">{formatINR(metrics.revenueRecovered)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Actual recovered money
          </p>
        </div>

        {/* Recovery Rate */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Recovery Rate
            </span>
          </div>
          <p className="metric-value text-cyan-400">{metrics.recoveryRate}%</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Of total at-risk amount
          </p>
        </div>

        {/* Active Cases */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Active Cases
            </span>
          </div>
          <p className="metric-value text-purple-400">{metrics.activeCases}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Awaiting recovery
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-400">{metrics.successfulRecoveries}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Successful Recoveries</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-500/15 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-400">{metrics.stoppedCases + metrics.escalatedCases}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Stopped / Escalated</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-cyan-400">
              {metrics.averageRecoveryTimeMs > 0 ? formatDuration(metrics.averageRecoveryTimeMs) : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Avg Recovery Time</p>
          </div>
        </div>
      </div>

      {/* Before / After Panel */}
      {hasProcessed && (
        <div className="glass-card p-6 slide-up">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            Recovery Impact
          </h2>
          <div className="grid grid-cols-3 gap-6 items-center">
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Before</p>
              <p className="text-2xl font-bold text-amber-400">{formatINR(metrics.revenueAtRisk)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">at risk</p>
            </div>
            <div className="text-center">
              <ArrowUpRight className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-emerald-400">Agent Recovered</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">After</p>
              <p className="text-2xl font-bold text-emerald-400 recovery-glow">
                {formatINR(metrics.revenueRecovered)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">recovered</p>
            </div>
          </div>
          <div className="mt-4 bg-[var(--color-bg-primary)] rounded-lg h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg transition-all duration-1000"
              style={{ width: `${Math.min(metrics.recoveryRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
            {formatINR(metrics.revenueAtRisk - metrics.revenueRecovered)} still unresolved/stopped
          </p>
        </div>
      )}

      {/* Quick Links + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Quick Actions
          </h3>
          <Link
            href="/batch"
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all group"
          >
            <div className="flex items-center gap-3">
              <PlayCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium">Run Recovery Batch</p>
                <p className="text-xs text-[var(--color-text-muted)]">Process all pending cases</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-emerald-400 transition-colors" />
          </Link>
          <Link
            href="/voice"
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all group"
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm font-medium">Voice Recovery Demo</p>
                <p className="text-xs text-[var(--color-text-muted)]">Hinglish voice recovery</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-cyan-400 transition-colors" />
          </Link>
          <Link
            href="/cases"
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all group"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium">View All Cases</p>
                <p className="text-xs text-[var(--color-text-muted)]">Browse recovery cases</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-purple-400 transition-colors" />
          </Link>
        </div>

        {/* Agent Activity Feed */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Agent Activity Feed
            </h3>
            {feed.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                Live
              </span>
            )}
          </div>

          {feed.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
              <p className="text-sm text-[var(--color-text-muted)]">No agent activity yet</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Run a recovery batch to see the agent in action</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
              {feed.map((item) => {
                const Icon = activityTypeIcons[item.type] || Activity;
                const color = activityTypeColors[item.type] || "text-gray-400";
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors"
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5 shrink-0 w-16">
                      {formatTime(item.createdAt)}
                    </span>
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {item.message}
                      </p>
                      {item.amountRecovered && item.amountRecovered > 0 && (
                        <p className="text-xs font-semibold text-emerald-400 mt-0.5 recovery-glow">
                          {formatINR(item.amountRecovered)} recovered
                        </p>
                      )}
                    </div>
                    {item.caseId && (
                      <Link
                        href={`/cases/${item.caseId}`}
                        className="text-[10px] text-[var(--color-text-muted)] hover:text-emerald-400 transition-colors shrink-0"
                      >
                        {item.caseId}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
