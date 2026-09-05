"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Clock,
  XCircle,
  ArrowUpRight,
  RefreshCw,
  IndianRupee,
  Phone,
  Zap,
  ArrowRight,
  Brain,
  ShieldAlert,
  Calendar,
  Volume2,
  Users,
  Settings,
  ChevronRight
} from "lucide-react";
import type { DashboardMetrics, ActivityFeedItem, RecoveryCampaign, RecoveryCase } from "@/lib/types";

// Types
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
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function timeFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

const activityTypeIcons: Record<string, typeof Activity> = {
  detection: AlertTriangle,
  diagnosis: Activity,
  scoring: TrendingUp,
  action: Zap,
  result: ArrowRight,
  recovery: CheckCircle2,
  stop: XCircle,
  human_takeover: ShieldAlert,
  human_resolve: CheckCircle2,
};

const activityTypeColors: Record<string, string> = {
  detection: "text-blue-400",
  diagnosis: "text-yellow-400",
  scoring: "text-purple-400",
  action: "text-cyan-400",
  result: "text-orange-400",
  recovery: "text-emerald-400",
  stop: "text-gray-400",
  human_takeover: "text-rose-400",
  human_resolve: "text-emerald-400",
};

const resolutionOptions = [
  { value: "recovered_manually", label: "Recovered manually" },
  { value: "payment_no_longer_required", label: "Payment no longer required" },
  { value: "customer_declined_permanently", label: "Customer declined permanently" },
  { value: "unable_to_recover", label: "Unable to recover" },
  { value: "other", label: "Other" },
];

export default function CommandCenter() {
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([]);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [cases, setCases] = useState<EnrichedCase[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Strategy Lab (What If) State
  const [labMaxAttempts, setLabMaxAttempts] = useState(3);

  // Resolve Modal State
  const [resolveCase, setResolveCase] = useState<EnrichedCase | null>(null);
  const [resolution, setResolution] = useState("recovered_manually");
  const [resolveNote, setResolveNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, feedRes, casesRes] = await Promise.all([
        fetch("/api/campaigns"),
        fetch("/api/agent/activity?limit=15"),
        fetch("/api/cases?limit=1000"),
      ]);
      const campaignData = await campaignRes.json();
      const feedData = await feedRes.json();
      const casesData = await casesRes.json();
      
      setCampaigns(campaignData.campaigns || []);
      setFeed(feedData.feed || []);
      setCases(casesData.cases || []);
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCampaignAction = async (id: string, action: "pause" | "resume" | "stop") => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchData();
  };

  const handleTakeOver = async (caseId: string) => {
    try {
      await fetch(`/api/cases/${caseId}/takeover`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error("Takeover failed", e);
    }
  };

  const handleResolve = async () => {
    if (!resolveCase) return;
    setSubmitting(true);
    try {
      await fetch(`/api/cases/${resolveCase.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, note: resolveNote }),
      });
      setResolveCase(null);
      setResolution("recovered_manually");
      setResolveNote("");
      fetchData();
    } catch (e) {
      console.error("Resolve failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] text-sm">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  const activeCampaign = campaigns.find(c => c.status === "RUNNING") || campaigns.find(c => c.status === "SCHEDULED") || campaigns[0];
  const campaignCases = activeCampaign ? cases.filter(c => activeCampaign.targetCaseIds.includes(c.id)) : [];
  
  // Live Queue Logic
  const currentlyProcessing = campaignCases.filter(c => ["DIAGNOSING", "ACTION_SELECTED", "ACTION_EXECUTING"].includes(c.state));
  const nowCase = currentlyProcessing.length > 0 ? currentlyProcessing[0] : null;
  const nextCases = campaignCases.filter(c => ["DETECTED", "VOICE_SCHEDULED"].includes(c.state) && c.id !== nowCase?.id).sort((a,b) => (a.scheduledFor && b.scheduledFor) ? new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime() : 0).slice(0, 5);
  const waitingCases = campaignCases.filter(c => c.state === "DELAYED_RETRY_SCHEDULED" && c.id !== nowCase?.id).sort((a,b) => new Date(a.nextAttemptAt || 0).getTime() - new Date(b.nextAttemptAt || 0).getTime()).slice(0, 5);
  const escalatedCases = campaignCases.filter(c => c.state === "ESCALATED" || c.state === "HUMAN_CONTROLLED");
  const upcomingCases = [...nextCases, ...waitingCases].sort((a,b) => new Date(a.scheduledFor || a.nextAttemptAt || 0).getTime() - new Date(b.scheduledFor || b.nextAttemptAt || 0).getTime());

  // Campaign-scoped metrics
  const campaignAtRisk = campaignCases.reduce((sum, c) => sum + c.amountAtRisk, 0);
  const campaignAutoRecovered = campaignCases.filter(c => c.state === "RECOVERED" && !c.isHumanRecovery).reduce((sum, c) => sum + c.amountRecovered, 0);
  const campaignHumanRecovered = campaignCases.filter(c => c.state === "RECOVERED" && c.isHumanRecovery).reduce((sum, c) => sum + c.humanRecoveredAmount, 0);
  const campaignTotalRecovered = campaignAutoRecovered + campaignHumanRecovered;
  const campaignRecoveryRate = campaignAtRisk > 0 ? (campaignTotalRecovered / campaignAtRisk) * 100 : 0;

  // Simulation logic for Lab
  const simRecoveryImpact = campaignTotalRecovered * (labMaxAttempts === 3 ? 1 : labMaxAttempts === 2 ? 0.78 : 1.12);
  const simContacts = campaignCases.reduce((sum, c) => sum + c.customerContacts, 0) * (labMaxAttempts === 3 ? 1 : labMaxAttempts === 2 ? 0.72 : 1.3);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 fade-in min-h-screen">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Recovery Operations Center</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-emerald-400">
               <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
               AUTONOMOUS RECOVERY ACTIVE
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/campaigns/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
            <Calendar className="w-4 h-4" />
            Create Campaign
          </Link>
          <Link href="/voice" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30">
            <Phone className="w-4 h-4" />
            Voice Console
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CAMPAIGN CONTROL & IMPACT */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {activeCampaign ? (
            <div className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Brain className="w-24 h-24" />
              </div>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                Campaign Control Center
              </h3>
              <Link href={`/campaigns/${activeCampaign.id}`} className="text-lg font-semibold hover:text-cyan-400 transition-colors">
                {activeCampaign.name}
              </Link>
              
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-text-muted)]">Status</span>
                  <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">{activeCampaign.status}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-text-muted)]">Started</span>
                  <span className="font-mono">{activeCampaign.startedAt ? formatTime(activeCampaign.startedAt) : "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-text-muted)]">Progress</span>
                  <span className="font-mono">{activeCampaign.processedCaseIds.length} / {activeCampaign.targetCaseIds.length}</span>
                </div>
              </div>

              <div className="mt-4 bg-[var(--color-bg-primary)] rounded-lg h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${(activeCampaign.processedCaseIds.length / Math.max(1, activeCampaign.targetCaseIds.length)) * 100}%` }} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">This Campaign — At Risk</p>
                   <p className="text-lg font-bold text-amber-400">{formatINR(campaignAtRisk)}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">This Campaign — Recovered</p>
                   <p className="text-lg font-bold text-emerald-400 recovery-glow">{formatINR(campaignTotalRecovered)}</p>
                   {campaignHumanRecovered > 0 && (
                     <p className="text-[10px] text-[var(--color-text-muted)]">
                       Auto: {formatINR(campaignAutoRecovered)} · Human: {formatINR(campaignHumanRecovered)}
                     </p>
                   )}
                 </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Recovery Rate</p>
                <p className="text-2xl font-bold text-cyan-400">{campaignRecoveryRate.toFixed(1)}%</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">of {formatINR(campaignAtRisk)} at risk</p>
              </div>

              <div className="mt-6 flex gap-2">
                 {activeCampaign.status === "RUNNING" && (
                   <>
                     <button onClick={() => handleCampaignAction(activeCampaign.id, "pause")} className="flex-1 flex justify-center items-center gap-1.5 p-2 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] rounded-lg text-sm text-[var(--color-text-secondary)] transition-colors">
                        <PauseCircle className="w-4 h-4"/> Pause
                     </button>
                     <button onClick={() => handleCampaignAction(activeCampaign.id, "stop")} className="flex-1 flex justify-center items-center gap-1.5 p-2 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] rounded-lg text-sm text-red-400 transition-colors">
                        <StopCircle className="w-4 h-4"/> Stop
                     </button>
                   </>
                 )}
                 {activeCampaign.status === "PAUSED" && (
                   <button onClick={() => handleCampaignAction(activeCampaign.id, "resume")} className="flex-1 flex justify-center items-center gap-1.5 p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-sm text-emerald-400 transition-colors">
                      <PlayCircle className="w-4 h-4"/> Resume
                   </button>
                 )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <Calendar className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <h3 className="text-sm font-semibold mb-2">No Active Campaign</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">Create a campaign to start autonomous recovery.</p>
              <Link href="/campaigns/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
                <Zap className="w-4 h-4" />
                Create Campaign
              </Link>
            </div>
          )}

          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              Recovery Impact
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                     <Users className="w-4 h-4 text-emerald-400"/>
                   </div>
                   <span className="text-sm font-medium">Customers Recovered</span>
                </div>
                <span className="font-bold text-emerald-400">{campaignCases.filter(c => c.state === "RECOVERED").length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                     <Volume2 className="w-4 h-4 text-cyan-400"/>
                   </div>
                   <span className="text-sm font-medium">Voice Recoveries</span>
                </div>
                <span className="font-bold text-cyan-400">{campaignCases.filter(c => c.recoveryChannel && (c.recoveryChannel.includes("voice") || c.recoveryChannel.includes("hinglish"))).length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                     <Zap className="w-4 h-4 text-purple-400"/>
                   </div>
                   <span className="text-sm font-medium">Auto Retries</span>
                </div>
                <span className="font-bold text-purple-400">{campaignCases.filter(c => c.recoveryChannel && (c.recoveryChannel.includes("retry"))).length}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                     <ShieldAlert className="w-4 h-4 text-amber-400"/>
                   </div>
                   <span className="text-sm font-medium">Escalated</span>
                </div>
                <span className="font-bold text-amber-400">
                   {escalatedCases.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: LIVE QUEUE & DECISIONS */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="glass-card p-5 min-h-[450px]">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                 Live Recovery Queue
               </h3>
               <Link href="/cases" className="text-xs text-cyan-400 hover:underline">View All Cases</Link>
            </div>

            {/* NOW */}
            <div className="mb-6">
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">Now Processing</h4>
              {nowCase ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 skeleton-shine" />
                   <div className="flex justify-between items-start mb-3 relative z-10">
                     <div>
                       <Link href={`/cases/${nowCase.id}`} className="text-lg font-bold text-white hover:text-emerald-400 transition-colors">{nowCase.customer?.name || "Customer"}</Link>
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
                   
                   {/* Agent Decision Panel for active case */}
                   <div className="mt-4 pt-4 border-t border-emerald-500/20 relative z-10">
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">Agent Reasoning</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                         <div>
                           <p className="text-[10px] text-[var(--color-text-muted)]">Recovery Score</p>
                           <p className="text-sm font-semibold text-emerald-400">{nowCase.recoveryScore}%</p>
                         </div>
                         <div>
                           <p className="text-[10px] text-[var(--color-text-muted)]">Failure Type</p>
                           <p className="text-sm font-semibold capitalize">{nowCase.event?.failureReason.replace(/_/g, " ")}</p>
                         </div>
                      </div>
                      <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                         <div className="flex items-start gap-2">
                           <Brain className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                           <p className="text-xs text-[var(--color-text-secondary)]">{nowCase.actionReason || "Analyzing case and policy parameters..."}</p>
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-center text-[var(--color-text-muted)] text-sm">
                  {activeCampaign ? "Agent is idle. Waiting for scheduled tasks." : "No active campaign. Create one to start recovery."}
                </div>
              )}
            </div>

            {/* UPCOMING */}
            <div>
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">Upcoming Actions</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {upcomingCases.map(c => (
                  <div key={c.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] flex justify-between items-center group">
                     <div>
                        <Link href={`/cases/${c.id}`} className="text-sm font-medium group-hover:text-cyan-400 transition-colors">{c.customer?.name}</Link>
                        <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                     </div>
                     <div className="text-right">
                        <span className="text-[10px] text-[var(--color-text-muted)] block">Attempt {c.totalAttempts + 1}</span>
                        <span className="text-xs font-mono text-cyan-400">{timeFromNow(c.scheduledFor || c.nextAttemptAt || new Date().toISOString())}</span>
                     </div>
                  </div>
                ))}
                {upcomingCases.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)] text-center py-2">No upcoming actions scheduled.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVITY & ESCALATIONS */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Human Intervention */}
          <div className="glass-card p-5 border-red-500/20">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4" />
                   Human Intervention Required
                </h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-bold">{escalatedCases.length}</span>
                  <Link href="/human-intervention" className="text-[10px] text-cyan-400 hover:underline">View All</Link>
                </div>
             </div>
             <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {escalatedCases.map(c => (
                  <div key={c.id} className="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                          <Link href={`/cases/${c.id}`} className="text-sm font-medium hover:text-cyan-400">{c.customer?.name}</Link>
                          <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                          {c.state === "HUMAN_CONTROLLED" ? "TAKEN OVER" : `${c.totalAttempts}/3 Exhausted`}
                        </span>
                     </div>
                     <div className="flex gap-2">
                        {c.state === "ESCALATED" && (
                          <button 
                            onClick={() => handleTakeOver(c.id)} 
                            className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-semibold rounded transition-colors"
                          >
                            Take Over
                          </button>
                        )}
                        <button 
                          onClick={() => { setResolveCase(c); setResolution("recovered_manually"); setResolveNote(""); }}
                          className="flex-1 py-1.5 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] text-emerald-400 text-[10px] font-semibold rounded border border-[var(--color-border)] transition-colors"
                        >
                          Resolve
                        </button>
                     </div>
                  </div>
                ))}
                {escalatedCases.length === 0 && (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-[var(--color-text-muted)]">No cases require manual intervention.</p>
                  </div>
                )}
             </div>
          </div>

          {/* Agent Activity Stream */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Agent Activity Stream
              </h3>
            </div>
            <div className="space-y-1 max-h-[250px] overflow-y-auto pr-2 relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-[var(--color-border)] z-0" />
              {feed.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No activity yet</p>
              ) : (
                feed.map((item) => {
                  const Icon = activityTypeIcons[item.type] || Activity;
                  const color = activityTypeColors[item.type] || "text-gray-400";
                  return (
                    <div key={item.id} className="relative z-10 flex items-start gap-3 py-2 px-1 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors">
                      <div className={`w-5 h-5 mt-0.5 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center shrink-0 border border-[var(--color-border)] ${color}`}>
                         <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                           <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{formatTime(item.createdAt)}</span>
                           {item.caseId && <Link href={`/cases/${item.caseId}`} className="text-[10px] text-[var(--color-text-muted)] hover:text-cyan-400">View</Link>}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                          {item.message}
                        </p>
                        {item.amountRecovered && item.amountRecovered > 0 && (
                          <p className="text-xs font-semibold text-emerald-400 mt-1">
                            {formatINR(item.amountRecovered)} RECOVERED
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Strategy Lab */}
          <div className="glass-card p-5">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                 <Settings className="w-4 h-4" />
                 Recovery Strategy Lab
               </h3>
               <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold">Simulation</span>
             </div>
             
             <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-xs text-[var(--color-text-muted)]">Max automated attempts</span>
                   <select 
                     value={labMaxAttempts} 
                     onChange={(e) => setLabMaxAttempts(Number(e.target.value))}
                     className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
                   >
                     <option value={2}>2</option>
                     <option value={3}>3 (Current)</option>
                     <option value={4}>4</option>
                   </select>
                </div>
                
                <div className="mt-4 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                   <p className="text-[10px] uppercase font-semibold text-purple-400 mb-2">Estimated Impact</p>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--color-text-muted)]">Revenue recovered</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs line-through text-[var(--color-text-muted)]">{formatINR(campaignTotalRecovered)}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                        <span className={`text-xs font-semibold ${labMaxAttempts === 3 ? "text-[var(--color-text-secondary)]" : "text-amber-400"}`}>{formatINR(simRecoveryImpact)}</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--color-text-muted)]">Customer contacts</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs line-through text-[var(--color-text-muted)]">{campaignCases.reduce((sum, c) => sum + c.customerContacts, 0)}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                        <span className={`text-xs font-semibold ${labMaxAttempts === 3 ? "text-[var(--color-text-secondary)]" : "text-emerald-400"}`}>{Math.round(simContacts)}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

      </div>

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
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
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
