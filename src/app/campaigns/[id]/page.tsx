"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PlayCircle,
  PauseCircle,
  StopCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Clock,
  XCircle,
  Brain,
  ShieldAlert,
  Users,
  Zap,
  AlertTriangle,
  Phone,
} from "lucide-react";
import type { RecoveryCampaign, RecoveryCase, ActivityFeedItem } from "@/lib/types";

interface EnrichedCase extends RecoveryCase {
  customer?: { name: string; preferredLanguage: string };
  event?: { failureReason: string; amount: number; eventType: string };
}

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${amount.toLocaleString("en-IN")}`;
  return `₹${amount}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function timeFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `in ${hours}h ${mins}m`;
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `in ${mins}m ${secs}s`;
  return `in ${secs}s`;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/20 text-gray-400",
  SCHEDULED: "bg-blue-500/20 text-blue-400",
  RUNNING: "bg-emerald-500/20 text-emerald-400",
  PAUSED: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-cyan-500/20 text-cyan-400",
  STOPPED: "bg-red-500/20 text-red-400",
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<RecoveryCampaign | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<{ processing: EnrichedCase[]; upNext: EnrichedCase[]; waiting: EnrichedCase[] }>({ processing: [], upNext: [], waiting: [] });
  const [escalated, setEscalated] = useState<EnrichedCase[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCampaign(data.campaign);
      setStats(data.stats || {});
      setQueue(data.queue || { processing: [], upNext: [], waiting: [] });
      setEscalated(data.escalated || []);
      setActivities(data.activities || []);
    } catch (e) {
      console.error("Failed to fetch campaign", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (action: "pause" | "resume" | "stop") => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] text-sm">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--color-text-muted)]">Campaign not found</p>
        <Link href="/" className="text-emerald-400 text-sm mt-2 inline-block">← Back to dashboard</Link>
      </div>
    );
  }

  const recoveryRate = stats.totalAtRisk > 0 ? ((stats.totalRecovered || 0) / stats.totalAtRisk * 100) : 0;
  const nowCase = queue.processing.length > 0 ? queue.processing[0] : null;
  const isActive = campaign.status === "RUNNING";
  const isScheduled = campaign.status === "SCHEDULED";

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 fade-in min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl hover:bg-[var(--color-bg-card)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusColors[campaign.status] || ""}`}>
                ● {campaign.status}
              </span>
            </div>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {isScheduled && campaign.scheduledFor && `Starts at ${formatTime(campaign.scheduledFor)}`}
              {isActive && campaign.startedAt && `Started at ${formatTime(campaign.startedAt)}`}
              {campaign.status === "COMPLETED" && "Completed"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <>
              <button onClick={() => handleAction("pause")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] text-amber-400 border border-[var(--color-border)] transition-colors">
                <PauseCircle className="w-4 h-4" /> Pause
              </button>
              <button onClick={() => handleAction("stop")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] text-red-400 border border-[var(--color-border)] transition-colors">
                <StopCircle className="w-4 h-4" /> Stop
              </button>
            </>
          )}
          {campaign.status === "PAUSED" && (
            <button onClick={() => handleAction("resume")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors">
              <PlayCircle className="w-4 h-4" /> Resume
            </button>
          )}
        </div>
      </div>

      {/* Scheduled Banner */}
      {isScheduled && (
        <div className="glass-card p-8 text-center border-blue-500/30 slide-up">
          <CheckCircle2 className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-blue-400 mb-2">CAMPAIGN SCHEDULED</h2>
          {campaign.scheduledFor && (
            <div className="space-y-2 text-sm">
              <p><span className="text-[var(--color-text-muted)]">Starts:</span> <span className="font-semibold">{formatTime(campaign.scheduledFor)}</span></p>
              <p><span className="text-[var(--color-text-muted)]">Target:</span> <span className="font-semibold">{campaign.targetCaseIds.length} eligible cases</span></p>
              <p><span className="text-[var(--color-text-muted)]">Amount at risk:</span> <span className="font-semibold text-amber-400">{formatINR(stats.totalAtRisk || campaign.totalTargetAmount)}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Progress</span>
          </div>
          <p className="text-xl font-bold">{campaign.processedCaseIds.length} / {campaign.targetCaseIds.length}</p>
          <div className="mt-2 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${(campaign.processedCaseIds.length / Math.max(1, campaign.targetCaseIds.length)) * 100}%` }} />
          </div>
        </div>
        
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">This Campaign — At Risk</span>
          </div>
          <p className="text-xl font-bold text-amber-400">{formatINR(stats.totalAtRisk || 0)}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">This Campaign — Recovered</span>
          </div>
          <p className="text-xl font-bold text-emerald-400 recovery-glow">{formatINR(stats.totalRecovered || 0)}</p>
          {(stats.humanRecovered || 0) > 0 && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Auto: {formatINR(stats.automatedRecovered || 0)} · Human: {formatINR(stats.humanRecovered || 0)}
            </p>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Recovery Rate</span>
          </div>
          <p className="text-xl font-bold text-cyan-400">{recoveryRate.toFixed(1)}%</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">of {formatINR(stats.totalAtRisk || 0)} at risk</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Human Intervention</span>
          </div>
          <p className="text-xl font-bold text-red-400">{stats.escalated || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Live Queue */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="glass-card p-5 min-h-[400px]">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-6">Live Recovery Queue</h3>

            {/* NOW PROCESSING */}
            <div className="mb-6">
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">Now Processing</h4>
              {nowCase ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 skeleton-shine" />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <Link href={`/cases/${nowCase.id}`} className="text-lg font-bold text-white hover:text-emerald-400">{nowCase.customer?.name || "Customer"}</Link>
                      <p className="text-sm text-emerald-400">{formatINR(nowCase.event?.amount || 0)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold px-2 py-1 rounded bg-[var(--color-bg-primary)]">Attempt {nowCase.totalAttempts + 1} / 3</span>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />
                        {nowCase.state.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  {nowCase.actionReason && (
                    <div className="mt-3 p-3 bg-[var(--color-bg-primary)] rounded-lg relative z-10">
                      <div className="flex items-start gap-2">
                        <Brain className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--color-text-secondary)]">{nowCase.actionReason}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-center text-[var(--color-text-muted)] text-sm">
                  Agent is idle. Waiting for scheduled tasks.
                </div>
              )}
            </div>

            {/* UP NEXT */}
            <div className="mb-6">
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">Up Next</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {queue.upNext.map(c => (
                  <div key={c.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] flex justify-between items-center">
                    <div>
                      <Link href={`/cases/${c.id}`} className="text-sm font-medium hover:text-cyan-400">{c.customer?.name}</Link>
                      <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[var(--color-text-muted)] block">Attempt {c.totalAttempts + 1}</span>
                      {c.scheduledFor && <span className="text-xs font-mono text-cyan-400">{timeFromNow(c.scheduledFor)}</span>}
                    </div>
                  </div>
                ))}
                {queue.upNext.length === 0 && <p className="text-xs text-[var(--color-text-muted)] text-center py-2">No upcoming cases.</p>}
              </div>
            </div>

            {/* WAITING */}
            <div>
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">Waiting (Retry Scheduled)</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {queue.waiting.map(c => (
                  <div key={c.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] flex justify-between items-center">
                    <div>
                      <Link href={`/cases/${c.id}`} className="text-sm font-medium hover:text-cyan-400">{c.customer?.name}</Link>
                      <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[var(--color-text-muted)] block">Retry {c.totalAttempts + 1}</span>
                      {c.nextAttemptAt && <span className="text-xs font-mono text-indigo-400">{timeFromNow(c.nextAttemptAt)}</span>}
                    </div>
                  </div>
                ))}
                {queue.waiting.length === 0 && <p className="text-xs text-[var(--color-text-muted)] text-center py-2">No waiting cases.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Human Intervention */}
          <div className="glass-card p-5 border-red-500/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Human Intervention Required
              </h3>
              <Link href="/human-intervention" className="text-[10px] text-cyan-400 hover:underline">View All</Link>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {escalated.map((c: EnrichedCase) => (
                <div key={c.id} className="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <Link href={`/cases/${c.id}`} className="text-sm font-medium hover:text-cyan-400">{c.customer?.name}</Link>
                      <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">{c.totalAttempts}/3</span>
                  </div>
                </div>
              ))}
              {escalated.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-[var(--color-text-muted)]">No cases require intervention.</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              Campaign Activity
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-[var(--color-border)] z-0" />
              {activities.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No activity yet</p>
              ) : (
                activities.map(item => (
                  <div key={item.id} className="relative z-10 flex items-start gap-3 py-2 px-1 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors">
                    <div className={`w-5 h-5 mt-0.5 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center shrink-0 border border-[var(--color-border)] ${
                      item.type === "recovery" ? "text-emerald-400" : item.type === "stop" ? "text-gray-400" : item.type === "detection" ? "text-blue-400" : "text-cyan-400"
                    }`}>
                      {item.type === "recovery" ? <CheckCircle2 className="w-3 h-3" /> :
                       item.type === "stop" ? <XCircle className="w-3 h-3" /> :
                       <Activity className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{formatTime(item.createdAt)}</span>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.message}</p>
                      {item.amountRecovered && item.amountRecovered > 0 && (
                        <p className="text-xs font-semibold text-emerald-400 mt-0.5">{formatINR(item.amountRecovered)} RECOVERED</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
