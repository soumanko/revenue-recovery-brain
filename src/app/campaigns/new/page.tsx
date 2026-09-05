"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Volume2,
  Zap,
  Phone,
  Shield,
  Play,
} from "lucide-react";

export default function CreateCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("September Payment Recovery");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("11:00");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [dailyVoiceLimit, setDailyVoiceLimit] = useState(3);
  const [demoMode, setDemoMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const scheduledFor = new Date(`${startDate}T${startTime}:00`).toISOString();

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scheduledFor,
          voiceEnabled,
          maxAttempts,
          dailyVoiceLimit,
          demoMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create campaign");
        setSubmitting(false);
        return;
      }

      // Redirect to campaign detail page
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (err) {
      setError("Failed to create campaign. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6 fade-in min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 rounded-xl hover:bg-[var(--color-bg-card)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Recovery Campaign</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Configure and schedule an automated recovery campaign
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Name */}
        <div className="glass-card p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Campaign Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., September Payment Recovery"
              required
              className="mt-2 w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-[var(--color-text-muted)]"
            />
          </label>
        </div>

        {/* Schedule */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Schedule
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)] mb-1 block">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)] mb-1 block">Start Time</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors"
              />
            </label>
          </div>
        </div>

        {/* Target */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Target
          </h3>
          <div className="p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">All eligible recovery cases</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Campaign will target all customers with pending payment failures, checkout abandonments, and subscription failures.
            </p>
          </div>
        </div>

        {/* Voice Recovery */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5" />
            Voice Recovery
          </h3>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setVoiceEnabled(true)}
              className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
                voiceEnabled
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"
              }`}
            >
              <Phone className="w-4 h-4 mb-2" />
              ● Enabled
            </button>
            <button
              type="button"
              onClick={() => setVoiceEnabled(false)}
              className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
                !voiceEnabled
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"
              }`}
            >
              ○ Disabled
            </button>
          </div>
        </div>

        {/* Limits */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Policy Limits
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)] mb-1 block">Maximum automated attempts</span>
              <select
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3 (Recommended)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)] mb-1 block">Voice calls / customer / day</span>
              <select
                value={dailyVoiceLimit}
                onChange={(e) => setDailyVoiceLimit(Number(e.target.value))}
                className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none focus:border-emerald-500/50 transition-colors"
              >
                <option value={1}>1 call/day</option>
                <option value={2}>2 calls/day</option>
                <option value={3}>3 calls/day (Recommended)</option>
              </select>
            </label>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              <strong>Recovery window:</strong> Uses existing merchant policy (72 hours)
            </p>
          </div>
        </div>

        {/* Demo Mode */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Demo Mode
          </h3>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setDemoMode(true)}
              className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
                demoMode
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"
              }`}
            >
              ● Enabled
              <p className="text-[10px] mt-1 opacity-70">Compressed delays for demo</p>
            </button>
            <button
              type="button"
              onClick={() => setDemoMode(false)}
              className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
                !demoMode
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                  : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"
              }`}
            >
              ○ Production
              <p className="text-[10px] mt-1 opacity-70">Real-time delays</p>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {submitting ? "Creating Campaign..." : "Schedule Campaign"}
        </button>
      </form>
    </div>
  );
}
