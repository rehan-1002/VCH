import React from "react";

export type TokenStatusType =
  | "WAITING"
  | "CALLED"
  | "SERVING"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "EMERGENCY"
  | "PAUSED"
  | "AVAILABLE"
  | "BUSY";

interface StatusBadgeProps {
  status: TokenStatusType | string;
  className?: string;
}

const statusStyles: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  WAITING: {
    label: "WAITING",
    bg: "bg-zinc-900 border-zinc-700",
    text: "text-zinc-300",
    dot: "bg-amber-400",
  },
  CALLED: {
    label: "NOW SERVING",
    bg: "bg-emerald-950/60 border-emerald-700/80",
    text: "text-emerald-300 font-bold",
    dot: "bg-emerald-400 animate-ping",
  },
  SERVING: {
    label: "IN SERVICE",
    bg: "bg-emerald-950/40 border-emerald-800",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    label: "COMPLETED",
    bg: "bg-zinc-900/60 border-zinc-800",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  CANCELLED: {
    label: "CANCELLED",
    bg: "bg-red-950/30 border-red-900/50",
    text: "text-red-400",
    dot: "bg-red-500",
  },
  NO_SHOW: {
    label: "NO-SHOW",
    bg: "bg-amber-950/30 border-amber-900/50",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  EMERGENCY: {
    label: "PRIORITY #1",
    bg: "bg-red-950/70 border-red-600",
    text: "text-red-300 font-bold",
    dot: "bg-red-500 animate-pulse",
  },
  AVAILABLE: {
    label: "READY",
    bg: "bg-emerald-950/30 border-emerald-800/60",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  BUSY: {
    label: "OCCUPIED",
    bg: "bg-blue-950/40 border-blue-800/60",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  PAUSED: {
    label: "PAUSED",
    bg: "bg-amber-950/40 border-amber-800/60",
    text: "text-amber-400 font-medium",
    dot: "bg-amber-400",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const config = statusStyles[normalized] || {
    label: normalized,
    bg: "bg-zinc-900 border-zinc-800",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono uppercase tracking-wider ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
