"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import type { BatchRun } from "@/lib/types";

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${amount.toLocaleString("en-IN")}`;
  return `₹${amount}`;
}

export default function BatchPage() {
  const [batch, setBatch] = useState<BatchRun | null>(null);
  const [batches, setBatches] = useState<BatchRun[]>([]);
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [displayedProcessed, setDisplayedProcessed] = useState(0);
  const [displayedRecovered, setDisplayedRecovered] = useState(0);

  const fetchBatches = useCallback(async () => {
    const res = await fetch("/api/batch");
    const data = await res.json();
    setBatches(data.batches || []);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Poll progress
  useEffect(() => {
    if (!batch || batch.status !== "processing") return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/batch?id=${batch.id}`);
        const data = await res.json();
        if (data.batch) {
          setBatch(data.batch);
          setDisplayedProcessed(data.batch.processedCases);
          setDisplayedRecovered(data.batch.totalRecovered);
          if (data.batch.status === "completed") {
            setRunning(false);
            fetchBatches();
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [batch?.id, batch?.status, fetchBatches]);

  const handleRunBatch = async () => {
    if (running) return;
    setRunning(true);
    setDisplayedProcessed(0);
    setDisplayedRecovered(0);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 500 }),
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        setRunning(false);
        return;
      }

      setBatch(data.batch);
      // Let polling handle the rest
    } catch (e) {
      console.error(e);
      setRunning(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    await fetch("/api/seed", { method: "POST" });
    setBatch(null);
    setBatches([]);
    setDisplayedProcessed(0);
    setDisplayedRecovered(0);
    await fetchBatches();
    setResetting(false);
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Recovery</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Process all pending revenue-risk events through the AI recovery agent
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={resetting || running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`} />
            Reset Data
          </button>
          <button
            onClick={handleRunBatch}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            {running ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            {running ? "Processing..." : "Run Recovery Batch"}
          </button>
        </div>
      </div>

      {/* Active Batch Results */}
      {batch && (
        <div className="space-y-6 slide-up">
          {/* Progress */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Batch Progress
              </h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                batch.status === "completed"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-cyan-500/20 text-cyan-400"
              }`}>
                {batch.status === "completed" ? "Complete" : "Processing..."}
              </span>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-secondary)]">
                  Processing {displayedProcessed} / {batch.totalCases}
                </span>
                <span className="font-medium">
                  {batch.totalCases > 0 ? Math.round((displayedProcessed / batch.totalCases) * 100) : 0}%
                </span>
              </div>
              <div className="h-4 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-300 relative"
                  style={{ width: `${batch.totalCases > 0 ? (displayedProcessed / batch.totalCases) * 100 : 0}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 shimmer rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">At Risk</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{formatINR(batch.totalAtRisk)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{batch.totalCases} cases</p>
            </div>

            <div className="glass-card p-5 border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">Recovered</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400 recovery-glow">{formatINR(displayedRecovered)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{batch.recoveredCases} cases</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">Stopped</span>
              </div>
              <p className="text-2xl font-bold text-gray-400">{batch.stoppedCases + batch.escalatedCases}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {batch.stoppedCases} stopped, {batch.escalatedCases} escalated
              </p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">Recovery Rate</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {batch.totalAtRisk > 0 ? ((displayedRecovered / batch.totalAtRisk) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">of total at risk</p>
            </div>
          </div>

          {/* Before / After */}
          {batch.status === "completed" && (
            <div className="glass-card p-8 slide-up">
              <h2 className="text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-6">
                Recovery Impact
              </h2>
              <div className="grid grid-cols-3 gap-8 items-center max-w-xl mx-auto">
                <div className="text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">BEFORE</p>
                  <p className="text-3xl font-bold text-amber-400">{formatINR(batch.totalAtRisk)}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">revenue at risk</p>
                </div>
                <div className="text-center">
                  <ArrowUpRight className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-400 mt-1">AI Agent</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">AFTER</p>
                  <p className="text-3xl font-bold text-emerald-400 recovery-glow">{formatINR(batch.totalRecovered)}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">recovered</p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {formatINR(batch.totalAtRisk - batch.totalRecovered)} unresolved/stopped •{" "}
                  <span className="text-emerald-400 font-semibold">
                    {batch.recoveredCases} successful interventions
                  </span>{" "}
                  • {batch.stoppedCases} deliberately stopped
                </p>
              </div>
            </div>
          )}

          {/* Summary Table */}
          {batch.status === "completed" && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                Batch Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Total Cases", value: batch.totalCases },
                  { label: "Total At Risk", value: formatINR(batch.totalAtRisk) },
                  { label: "Total Recovered", value: formatINR(batch.totalRecovered), highlight: true },
                  { label: "Recovery Rate", value: `${batch.totalAtRisk > 0 ? ((batch.totalRecovered / batch.totalAtRisk) * 100).toFixed(1) : 0}%` },
                  { label: "Recovered Cases", value: batch.recoveredCases },
                  { label: "Failed Cases", value: batch.failedCases },
                  { label: "Stopped Cases", value: batch.stoppedCases },
                  { label: "Escalated Cases", value: batch.escalatedCases },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-[var(--color-border)]/50">
                    <span className="text-[var(--color-text-muted)]">{item.label}</span>
                    <span className={`font-medium ${"highlight" in item && item.highlight ? "text-emerald-400" : ""}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous Batches */}
      {batches.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            Previous Batches
          </h3>
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 px-4 bg-[var(--color-bg-primary)] rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">{b.id}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    b.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-cyan-500/20 text-cyan-400"
                  }`}>
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-[var(--color-text-muted)]">{b.totalCases} cases</span>
                  <span className="text-amber-400">{formatINR(b.totalAtRisk)} at risk</span>
                  <span className="text-emerald-400 font-semibold">{formatINR(b.totalRecovered)} recovered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!batch && batches.length === 0 && (
        <div className="glass-card p-12 text-center">
          <PlayCircle className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold mb-2">Ready to Run Recovery</h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Click &ldquo;Run Recovery Batch&rdquo; to process all pending revenue-risk events through the AI recovery agent. 
            The agent will diagnose each case, select the best intervention, and execute recovery actions.
          </p>
        </div>
      )}
    </div>
  );
}
