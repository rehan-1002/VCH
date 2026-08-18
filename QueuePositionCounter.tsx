// components/user/LiveQueueHero.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QueuePositionCounter } from "./QueuePositionCounter";
import { Clock, ShieldAlert, ArrowDown } from "lucide-react";

interface LiveQueueHeroProps {
  position: number;
  estimatedWaitMins: number;
  tokenNumber: string;
  isEmergency?: boolean;
}

export function LiveQueueHero({
  position,
  estimatedWaitMins,
  tokenNumber,
  isEmergency = false,
}: LiveQueueHeroProps) {
  const [hasChanged, setHasChanged] = useState(false);

  // Trigger a brief micro-flash on position decrement
  useEffect(() => {
    setHasChanged(true);
    const timer = setTimeout(() => setHasChanged(false), 800);
    return () => clearTimeout(timer);
  }, [position]);

  return (
    <motion.div
      layout
      className={`relative w-full overflow-hidden rounded-xl border bg-zinc-950 p-6 transition-colors duration-500 ${
        isEmergency
          ? "border-red-600/50 bg-red-950/10 shadow-[0_0_30px_rgba(220,38,38,0.15)]"
          : hasChanged
          ? "border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
          : "border-zinc-800"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Assigned Pass
          </span>
          <span className="text-xl font-mono font-bold text-white tracking-wider mt-0.5">
            {tokenNumber}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-mono text-zinc-300 uppercase">Live Queue</span>
        </div>
      </div>

      {/* Main Position Display with Skiper37 NumberFlow Engine */}
      <div className="my-8 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-2">
          Current Position Ahead
        </span>

        <QueuePositionCounter
          value={position}
          size="hero"
          className={position === 1 ? "text-emerald-400" : "text-white"}
        />

        <AnimatePresence>
          {hasChanged && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center gap-1 text-[11px] font-mono text-emerald-400"
            >
              <ArrowDown className="w-3 h-3" /> Position updated
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-400" /> Estimated Wait
          </span>
          <span className="mt-1 font-mono text-base font-semibold text-zinc-200">
            ~{estimatedWaitMins} mins
          </span>
        </div>

        <div className="flex flex-col border-l border-zinc-800/80 pl-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Priority Tier
          </span>
          <span
            className={`mt-1 font-mono text-base font-semibold uppercase ${
              isEmergency ? "text-red-400" : "text-zinc-200"
            }`}
          >
            {isEmergency ? "Emergency #1" : "Standard"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}