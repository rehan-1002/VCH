"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Tv,
  Volume2,
  VolumeX,
  Clock,
  Building,
  CheckCircle2,
  Bell,
  ArrowRight,
} from "lucide-react";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { useRealtimeQueue } from "@/components/hooks/useRealtimeQueue";
import { QueueEventPayload } from "@/lib/realtime/events";

interface ServingCall {
  tokenId: string;
  displayNumber: string;
  counterNumber: number;
  counterName: string;
  queueName: string;
  calledAt: string;
}

export default function PublicDisplayPage() {
  const [currentCall, setCurrentCall] = useState<ServingCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<ServingCall[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const announcedEventIdsRef = useRef<Set<string>>(new Set());

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Speech API Voice Announcement
  const announceCall = useCallback(
    (text: string, eventId: string) => {
      if (!isAudioEnabled) return;
      if (announcedEventIdsRef.current.has(eventId)) return; // Prevent duplicate speech
      announcedEventIdsRef.current.add(eventId);

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.95; // Clear operational cadence
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("Speech Synthesis error:", err);
        }
      }
    },
    [isAudioEnabled]
  );

  // Fetch initial active counters & called tokens
  const fetchDisplayState = useCallback(async () => {
    try {
      const [cRes, tRes] = await Promise.allSettled([
        fetch("/api/counters").then((r) => r.json()),
        fetch("/api/tokens?status=CALLED").then((r) => r.json()),
      ]);

      let callFound: ServingCall | null = null;

      if (cRes.status === "fulfilled" && cRes.value.success && cRes.value.counters) {
        const busyCounters = cRes.value.counters.filter(
          (c: any) => c.currentServingTokenId && c.currentServingToken
        );

        if (busyCounters.length > 0) {
          const latest = busyCounters[0];
          callFound = {
            tokenId: latest.currentServingToken.id,
            displayNumber: latest.currentServingToken.displayNumber,
            counterNumber: latest.number,
            counterName: latest.name,
            queueName: latest.queue?.name || "Service",
            calledAt: latest.currentServingToken.calledAt || new Date().toISOString(),
          };
        }
      }

      if (!callFound && tRes.status === "fulfilled" && tRes.value.success && tRes.value.tokens?.length > 0) {
        const latestToken = tRes.value.tokens[0];
        callFound = {
          tokenId: latestToken.id,
          displayNumber: latestToken.displayNumber,
          counterNumber: latestToken.counter?.number || 1,
          counterName: latestToken.counter?.name || "Counter 01",
          queueName: latestToken.queue?.name || "Service",
          calledAt: latestToken.calledAt || new Date().toISOString(),
        };
      }

      if (callFound) {
        setCurrentCall(callFound);
        setRecentCalls((prev) => {
          if (prev.length === 0 && callFound) return [callFound];
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load display state:", err);
    }
  }, []);

  useEffect(() => {
    fetchDisplayState();
  }, [fetchDisplayState]);

  // Handle Realtime Events
  const handleRealtimeEvent = useCallback(
    (event: QueueEventPayload) => {
      if (event.type === "TOKEN_CALLED" || event.type === "TOKEN_RECALLED") {
        const { token, counter, announcement } = event.data;
        if (token && counter) {
          const newCall: ServingCall = {
            tokenId: token.id,
            displayNumber: token.displayNumber,
            counterNumber: counter.number,
            counterName: counter.name,
            queueName: token.queueName || "Service",
            calledAt: new Date().toISOString(),
          };

          setCurrentCall(newCall);
          setRecentCalls((prev) => [newCall, ...prev.filter((c) => c.displayNumber !== token.displayNumber).slice(0, 5)]);

          // Trigger speech announcement
          const speechText =
            announcement ||
            `Token ${token.displayNumber}, please proceed to ${counter.name}.`;
          announceCall(speechText, event.id);
        }
      } else {
        fetchDisplayState();
      }
    },
    [announceCall, fetchDisplayState]
  );

  const { connectionState } = useRealtimeQueue({
    onEvent: handleRealtimeEvent,
    onReconcile: () => {
      fetchDisplayState();
    },
  });

  // 3-second auto-polling fallback
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDisplayState();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchDisplayState]);

  return (
    <div
      onClick={() => setHasInteracted(true)}
      className="min-h-[85vh] flex flex-col justify-between space-y-8 max-w-7xl mx-auto select-none"
    >
      {/* Top TV Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <Building className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-mono font-extrabold tracking-wider text-white">
              CAMPUS SERVICE HUB
            </h1>
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              Institutional Public Queue Display
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Digital Clock */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="font-mono text-xl font-bold tracking-widest text-zinc-100 tabular-nums">
              {currentTime || "00:00:00"}
            </span>
          </div>

          {/* Audio Announce Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAudioEnabled(!isAudioEnabled);
              setHasInteracted(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white"
          >
            {isAudioEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Voice ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-zinc-500" />
                <span className="hidden sm:inline">Voice Muted</span>
              </>
            )}
          </button>

          <ConnectionBadge state={connectionState} />
        </div>
      </div>

      {/* Main Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto">
        {/* Dominant Hero Call Card (TV View Distance Hero) */}
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/80 bg-zinc-950 p-8 sm:p-12 text-center shadow-[0_0_60px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center min-h-[420px]">
            {/* Top Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs sm:text-sm font-bold uppercase tracking-widest mb-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              NOW SERVING
            </div>

            {currentCall ? (
              <div className="space-y-6 w-full">
                {/* Hero Token Display Number */}
                <div className="font-mono text-7xl sm:text-9xl font-black text-white tracking-widest tabular-nums leading-none">
                  {currentCall.displayNumber}
                </div>

                {/* Counter & Proceed Instruction */}
                <div className="pt-6 border-t border-zinc-850 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 block">
                      PROCEED TO
                    </span>
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-wider">
                      {currentCall.counterName}
                    </span>
                  </div>

                  <div className="hidden sm:block h-10 w-px bg-zinc-800" />

                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 block">
                      SERVICE DEPARTMENT
                    </span>
                    <span className="text-sm font-mono text-zinc-300 font-semibold">
                      {currentCall.queueName}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Tv className="w-16 h-16 text-zinc-700 mx-auto" />
                <span className="font-mono text-2xl font-bold uppercase text-zinc-400 block tracking-wider">
                  Waiting for Next Call
                </span>
                <span className="text-sm font-mono text-zinc-600">
                  Counters will announce tokens shortly.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Calls Ledger */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <span className="text-xs font-mono uppercase font-bold tracking-widest text-zinc-300">
                Recent Calls
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                Past Calls Ledger
              </span>
            </div>

            <div className="space-y-3 flex-1">
              {recentCalls.length > 0 ? (
                recentCalls.map((call, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono"
                  >
                    <span className="text-xl font-bold text-zinc-200 tracking-wider">
                      {call.displayNumber}
                    </span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-xs font-semibold text-emerald-400">
                        {call.counterName}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-xs font-mono text-zinc-600">
                  No prior calls recorded today.
                </div>
              )}
            </div>

            {/* Public Audio Hint */}
            {!hasInteracted && (
              <div className="mt-4 pt-3 border-t border-zinc-850 text-center">
                <span className="text-[10px] font-mono text-zinc-500">
                  Tap anywhere on screen to enable audio speech
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer System Ticker */}
      <div className="border-t border-zinc-900 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-zinc-500 gap-2">
        <span>Please have your Digital Token Mobile Pass or ticket reference ready upon approach.</span>
        <span>Physical Queue Sync Engine • Live Realtime Broadcast</span>
      </div>
    </div>
  );
}
