"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  QrCode,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  GraduationCap,
  CreditCard,
  Smartphone,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { useRealtimeQueue } from "@/components/hooks/useRealtimeQueue";

interface QueueItem {
  id: string;
  name: string;
  code: string;
  department: string;
  description: string;
  status: string;
  estimatedServiceTime: number;
  waitingCount: number;
  activeCounters: number;
  waitingTokens: any[];
}

export default function CheckInPage() {
  const router = useRouter();
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [visitorName, setVisitorName] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  // AI Triage state
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isAiTriaging, setIsAiTriaging] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(`${window.location.origin}/join`);
    }
  }, []);

  // Fetch initial queues
  const fetchQueues = async () => {
    try {
      const res = await fetch("/api/queues");
      const data = await res.json();
      if (data.success && data.queues) {
        setQueues(data.queues);
        if (data.queues.length > 0 && !selectedQueueId) {
          setSelectedQueueId(data.queues[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load queues:", err);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  // Realtime subscription to live updates
  const { connectionState } = useRealtimeQueue({
    onEvent: () => {
      fetchQueues();
    },
    onReconcile: () => {
      fetchQueues();
    },
  });

  // 3-second auto-polling fallback
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueues();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle AI Triage
  const handleAiTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAiTriaging(true);
    setError(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "TRIAGE", prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (data.success && data.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
        setSelectedQueueId(data.suggestions[0].queueId);
        setPurpose(aiPrompt.trim());
      }
    } catch (err) {
      console.error("AI Triage error:", err);
    } finally {
      setIsAiTriaging(false);
    }
  };

  // Handle Token Creation
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueId) {
      setError("Please select a service queue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueId: selectedQueueId,
          visitorName: visitorName.trim() || "Visitor",
          purpose: purpose.trim() || "General Service",
          turnstileToken: "bypass-dev-token",
          honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create token");
      }

      // Navigate to Visitor Mobile Pass
      router.push(`/ticket/${data.token.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to join queue");
      setIsSubmitting(false);
    }
  };

  const getQueueIcon = (code: string) => {
    switch (code) {
      case "A":
        return <Building className="w-5 h-5 text-emerald-400" />;
      case "B":
        return <GraduationCap className="w-5 h-5 text-blue-400" />;
      case "C":
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      default:
        return <Users className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 hover:text-zinc-300">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Overview
            </Link>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-zinc-500">
            Institutional Entry Portal
          </span>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight text-white mt-1">
            Visitor Digital Check-In
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Join the authoritative virtual queue. Receive a live mobile pass with dynamic position updates and audio call alerts.
          </p>
        </div>
        <ConnectionBadge state={connectionState} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: AI Intent Triage & Join Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI Smart Department Routing */}
          <Panel
            title="Intelligent Service Routing"
            subtitle="Describe your request in natural language for automated department recommendation"
            badge={
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                <Sparkles className="w-3 h-3 text-emerald-400" /> COHERE AI
              </span>
            }
          >
            <form onSubmit={handleAiTriage} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="E.g., I need my semester transcript and official grade stamp..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  isLoading={isAiTriaging}
                  icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                >
                  Analyze & Recommend
                </Button>
              </div>
            </form>

            {aiSuggestions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-850 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Recommended Match:
                </span>
                {aiSuggestions.slice(0, 1).map((sug, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded bg-zinc-900 border border-emerald-900/60 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-emerald-400">
                        Queue [{sug.queueCode}] - {sug.queueName}
                      </span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{sug.reasoning}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      {Math.round(sug.confidence * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Main Join Queue Form */}
          <Panel title="Issue Digital Token" subtitle="Select your target department to join the live queue">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateToken} className="space-y-4">
              {/* Honeypot for bots */}
              <input
                type="text"
                name="user_ref_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Department Queue Selection */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Target Service Queue *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {queues.map((q) => {
                    const isSelected = selectedQueueId === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setSelectedQueueId(q.id)}
                        className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-zinc-900 border-zinc-200 ring-1 ring-zinc-200"
                            : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                            {getQueueIcon(q.code)}
                          </div>
                          <span className="text-xs font-mono font-bold text-zinc-400">
                            [{q.code}]
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-zinc-100 line-clamp-1">
                          {q.name}
                        </span>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>{q.waitingCount} waiting</span>
                          <span>~{q.estimatedServiceTime}m avg</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visitor Name */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Visitor Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alice Miller"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              {/* Purpose of Visit */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Specific Request / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transcript Verification / Scholarship Claim"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isSubmitting}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Generate Live Queue Token
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        {/* Right Column: Live Operational Status & Real Scannable QR Code */}
        <div className="lg:col-span-5 space-y-6">
          {/* Physical QR Scan Emulation with Real Scannable QRCode Canvas */}
          <Panel
            title="Physical Kiosk QR Code"
            subtitle="Scan with mobile camera to open live virtual queue on phone"
          >
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <QRCodeDisplay value={currentUrl} size={190} className="mb-3" />
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-semibold mt-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Scannable Live Portal</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 mt-1 max-w-xs break-all">
                {currentUrl}
              </span>
              <span className="text-[10px] text-zinc-500 mt-2">
                Point any mobile camera to instantly join without physical line
              </span>
            </div>
          </Panel>

          {/* Quick Demo Passes Jump */}
          <Panel
            title="Benchmark Demo Passes"
            subtitle="Instant access to test visitor passes"
          >
            <div className="space-y-2">
              {queues
                .flatMap((q) => q.waitingTokens || [])
                .slice(0, 4)
                .map((token: any) => (
                  <button
                    key={token.id}
                    onClick={() => router.push(`/ticket/${token.id}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {token.displayNumber}
                      </span>
                      <div>
                        <span className="text-xs text-zinc-200 block">{token.visitorName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {token.purpose}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={token.priority === "EMERGENCY" ? "EMERGENCY" : "WAITING"} />
                      <span className="text-xs font-mono text-zinc-400">Pos #{token.position}</span>
                    </div>
                  </button>
                ))}
              {queues.flatMap((q) => q.waitingTokens || []).length === 0 && (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  No active tokens in queue. Use Admin to seed demo data.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
