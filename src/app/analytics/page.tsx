"use client";

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface AnalyticsData {
  byEventType: { type: string; atRisk: number; recovered: number; count: number }[];
  byIntervention: { intervention: string; recovered: number; count: number }[];
  byFailureReason: { reason: string; atRisk: number; recovered: number; rate: number; count: number }[];
}

function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

const eventTypeLabels: Record<string, string> = {
  payment_failure: "Payment Failure",
  checkout_abandonment: "Checkout Abandonment",
  subscription_failure: "Subscription Failure",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = data.byIntervention.length > 0 || data.byEventType.some((d) => d.recovered > 0);

  const interventionData = data.byIntervention.map((d) => ({
    name: d.intervention,
    recovered: d.recovered,
    count: d.count,
  }));

  const eventTypeData = data.byEventType.map((d) => ({
    name: eventTypeLabels[d.type] || d.type,
    atRisk: d.atRisk,
    recovered: d.recovered,
    rate: d.atRisk > 0 ? ((d.recovered / d.atRisk) * 100).toFixed(1) : "0",
  }));

  const failureReasonData = data.byFailureReason
    .filter((d) => d.recovered > 0)
    .sort((a, b) => b.recovered - a.recovered)
    .map((d) => ({
      name: d.reason.replace(/_/g, " "),
      recovered: d.recovered,
      rate: d.rate,
      count: d.count,
    }));

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recovery Analytics</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Actual recovered money by event type, intervention, and failure reason
        </p>
      </div>

      {!hasData ? (
        <div className="glass-card p-12 text-center">
          <BarChart3 className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--color-text-muted)]">No recovery data yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Run a recovery batch to see analytics</p>
        </div>
      ) : (
        <>
          {/* Revenue by Event Type */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                Revenue by Event Type
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={eventTypeData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3042" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatINR(v)} />
                  <Tooltip
                    contentStyle={{ background: "#1a1f2e", border: "1px solid #2a3042", borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [formatINR(Number(value))]}
                  />
                  <Bar dataKey="atRisk" fill="#f59e0b" name="At Risk" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recovered" fill="#10b981" name="Recovered" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Intervention */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                Recovered by Intervention
              </h3>
              {interventionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={interventionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="recovered"
                      nameKey="name"
                    >
                      {interventionData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1f2e", border: "1px solid #2a3042", borderRadius: 12, fontSize: 12 }}
                      formatter={(value) => [formatINR(Number(value))]}
                    />
                    <Legend
                      formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                  No intervention data yet
                </div>
              )}
            </div>
          </div>

          {/* Recovery by Failure Reason */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              Recovery by Failure Reason
            </h3>
            {failureReasonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={failureReasonData} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3042" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatINR(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} width={130} />
                  <Tooltip
                    contentStyle={{ background: "#1a1f2e", border: "1px solid #2a3042", borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [formatINR(Number(value))]}
                  />
                  <Bar dataKey="recovered" fill="#10b981" name="Recovered" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                No data
              </div>
            )}
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.byIntervention.map((d, i) => (
              <div key={d.intervention} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-[var(--color-text-muted)] capitalize">{d.intervention}</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">{formatINR(d.recovered)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{d.count} recoveries</p>
              </div>
            ))}
          </div>

          {/* Failure Reason Table */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              Recovery Rate by Failure Reason
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="text-left py-2 px-3 text-xs uppercase">Failure Reason</th>
                  <th className="text-right py-2 px-3 text-xs uppercase">At Risk</th>
                  <th className="text-right py-2 px-3 text-xs uppercase">Recovered</th>
                  <th className="text-right py-2 px-3 text-xs uppercase">Rate</th>
                  <th className="text-right py-2 px-3 text-xs uppercase">Cases</th>
                </tr>
              </thead>
              <tbody>
                {data.byFailureReason.map((d) => (
                  <tr key={d.reason} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card-hover)] transition-colors">
                    <td className="py-2.5 px-3 capitalize">{d.reason.replace(/_/g, " ")}</td>
                    <td className="py-2.5 px-3 text-right text-amber-400">{formatINR(d.atRisk)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">{formatINR(d.recovered)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-medium ${d.rate >= 40 ? "text-emerald-400" : d.rate >= 20 ? "text-yellow-400" : "text-red-400"}`}>
                        {d.rate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
