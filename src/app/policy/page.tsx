"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RotateCcw,
  Shield,
  Phone,
  RefreshCw,
  Clock,
  Target,
  CheckCircle2,
} from "lucide-react";
import type { MerchantPolicy } from "@/lib/types";

export default function PolicyPage() {
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/policy")
      .then((r) => r.json())
      .then((data) => setPolicy(data.policy))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      setPolicy(data.policy);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setPolicy({
      id: "default",
      maxRetries: 2,
      maxCustomerContacts: 2,
      recoveryWindowHours: 48,
      minRecoveryProbabilityForRetry: 65,
      minAmountForVoiceRecovery: 2000,
      enableVoiceRecovery: true,
      enableAutoRetry: true,
      updatedAt: new Date().toISOString(),
    });
  };

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Merchant Policy</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Configure recovery agent behavior and guardrails
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? "Saved!" : "Save Policy"}
          </button>
        </div>
      </div>

      {/* Recovery Limits */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Recovery Limits
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Retries */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
              <label className="text-sm font-medium">Maximum Retries</label>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              value={policy.maxRetries}
              onChange={(e) => setPolicy({ ...policy, maxRetries: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>0</span>
              <span className="text-emerald-400 font-semibold text-sm">{policy.maxRetries}</span>
              <span>5</span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Maximum number of payment retry attempts per case
            </p>
          </div>

          {/* Max Customer Contacts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
              <label className="text-sm font-medium">Maximum Customer Contacts</label>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              value={policy.maxCustomerContacts}
              onChange={(e) => setPolicy({ ...policy, maxCustomerContacts: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>0</span>
              <span className="text-emerald-400 font-semibold text-sm">{policy.maxCustomerContacts}</span>
              <span>5</span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Maximum notifications or voice calls to a single customer
            </p>
          </div>

          {/* Recovery Window */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
              <label className="text-sm font-medium">Recovery Window (Hours)</label>
            </div>
            <input
              type="range"
              min="1"
              max="168"
              value={policy.recoveryWindowHours}
              onChange={(e) => setPolicy({ ...policy, recoveryWindowHours: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>1h</span>
              <span className="text-emerald-400 font-semibold text-sm">{policy.recoveryWindowHours}h</span>
              <span>168h</span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Time window after which recovery attempts stop automatically
            </p>
          </div>

          {/* Min Recovery Probability */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
              <label className="text-sm font-medium">Minimum Retry Probability</label>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={policy.minRecoveryProbabilityForRetry}
              onChange={(e) => setPolicy({ ...policy, minRecoveryProbabilityForRetry: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>0%</span>
              <span className="text-emerald-400 font-semibold text-sm">{policy.minRecoveryProbabilityForRetry}%</span>
              <span>100%</span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Minimum recovery score required before attempting a retry
            </p>
          </div>
        </div>
      </div>

      {/* Voice Recovery Settings */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Voice Recovery
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Enable Voice */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-primary)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Enable Voice Recovery</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                Allow Hinglish voice calls for recovery
              </p>
            </div>
            <button
              onClick={() => setPolicy({ ...policy, enableVoiceRecovery: !policy.enableVoiceRecovery })}
              className={`w-12 h-6 rounded-full transition-all ${
                policy.enableVoiceRecovery ? "bg-emerald-500" : "bg-[var(--color-border)]"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-all ${
                policy.enableVoiceRecovery ? "translate-x-6" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {/* Enable Auto Retry */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-primary)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Enable Auto Retry</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                Automatically retry transient failures
              </p>
            </div>
            <button
              onClick={() => setPolicy({ ...policy, enableAutoRetry: !policy.enableAutoRetry })}
              className={`w-12 h-6 rounded-full transition-all ${
                policy.enableAutoRetry ? "bg-emerald-500" : "bg-[var(--color-border)]"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-all ${
                policy.enableAutoRetry ? "translate-x-6" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {/* Min Amount for Voice */}
          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-medium">Minimum Amount for Voice Recovery</label>
            <div className="flex items-center gap-4">
              <span className="text-[var(--color-text-muted)]">₹</span>
              <input
                type="number"
                min="0"
                step="500"
                value={policy.minAmountForVoiceRecovery}
                onChange={(e) => setPolicy({ ...policy, minAmountForVoiceRecovery: parseInt(e.target.value) || 0 })}
                className="flex-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Only use voice recovery for transactions above this amount
            </p>
          </div>
        </div>
      </div>

      {/* Current Policy Summary */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
          Active Policy Summary
        </h3>
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-4 font-mono text-xs text-[var(--color-text-secondary)] leading-relaxed">
          <pre>{JSON.stringify({
            maxRetries: policy.maxRetries,
            maxCustomerContacts: policy.maxCustomerContacts,
            recoveryWindowHours: policy.recoveryWindowHours,
            minRecoveryProbabilityForRetry: `${policy.minRecoveryProbabilityForRetry}%`,
            minAmountForVoiceRecovery: `₹${policy.minAmountForVoiceRecovery.toLocaleString("en-IN")}`,
            enableVoiceRecovery: policy.enableVoiceRecovery,
            enableAutoRetry: policy.enableAutoRetry,
          }, null, 2)}</pre>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
          Last updated: {new Date(policy.updatedAt).toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
