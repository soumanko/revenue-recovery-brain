"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  PlayCircle,
  Phone,
  BarChart3,
  Shield,
  Settings,
  Brain,
  Activity,
  Zap,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/campaigns/new", label: "Create Campaign", icon: Zap },
  { href: "/cases", label: "Recovery Cases", icon: FileSearch },
  { href: "/human-intervention", label: "Human Intervention", icon: ShieldAlert },
  { href: "/batch", label: "Batch Recovery", icon: PlayCircle },
  { href: "/voice", label: "Voice Recovery", icon: Phone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/audit", label: "Audit Trail", icon: Shield },
  { href: "/policy", label: "Policy", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Recovery Brain
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
              AI Revenue Recovery
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="px-4 py-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400 pulse-dot" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Agent Active
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1 opacity-60">
          Simulated Mode
        </p>
      </div>
    </aside>
  );
}
