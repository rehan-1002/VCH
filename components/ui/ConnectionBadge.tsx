import React from "react";
import { ConnectionState } from "../hooks/useRealtimeQueue";

interface ConnectionBadgeProps {
  state: ConnectionState;
  className?: string;
}

export function ConnectionBadge({ state, className = "" }: ConnectionBadgeProps) {
  if (state === "CONNECTED") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider">
          LIVE / CONNECTED
        </span>
      </div>
    );
  }

  if (state === "RECONNECTING") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="text-[11px] font-mono text-amber-300 uppercase tracking-wider font-semibold">
          RECONNECTING...
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-red-950/60 border border-red-800/80 px-2.5 py-1 ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-[11px] font-mono text-red-300 uppercase tracking-wider font-semibold">
        OFFLINE / SYNCING
      </span>
    </div>
  );
}
