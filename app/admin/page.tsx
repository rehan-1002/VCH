"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Users,
  Monitor,
  Activity,
  BarChart3,
  Sparkles,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Layers,
  AlertTriangle,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { useRealtimeQueue } from "@/components/hooks/useRealtimeQueue";

export default function AdminCockpitPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "emergencies" | "tokens" | "analytics" | "system"
  >("overview");

  const [queues, setQueues] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);

  // AI Report state
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // Seeder state
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAdminData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetch("/api/queues").then((r) => r.json()),
        fetch("/api/counters").then((r) => r.json()),
        fetch("/api/tokens").then((r) => r.json()),
        fetch("/api/emergency").then((r) => r.json()),
        fetch("/api/analytics").then((r) => r.json()),
      ]);

      if (results[0].status === "fulfilled" && results[0].value.success) {
        setQueues(results[0].value.queues || []);
      }
      if (results[1].status === "fulfilled" && results[1].value.success) {
        setCounters(results[1].value.counters || []);
      }
      if (results[2].status === "fulfilled" && results[2].value.success) {
        setTokens(results[2].value.tokens || []);
      }
      if (results[3].status === "fulfilled" && results[3].value.success) {
        setEmergencyRequests(results[3].value.requests || []);
      }
      if (results[4].status === "fulfilled" && results[4].value.success) {
        setAnalytics(results[4].value.analytics || null);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Realtime hook - receives all events globally
  const { connectionState } = useRealtimeQueue({
    onEvent: () => {
      fetchAdminData();
    },
    onReconcile: () => {
      fetchAdminData();
    },
  });

  // 3-second auto-polling fallback for live sync
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAdminData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  // Emergency Approval / Rejection
  const handleReviewEmergency = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(`${requestId}_${action}`);
    try {
      const res = await fetch("/api/emergency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          reviewer: "System Administrator",
          notes: action === "APPROVE" ? "Priority verified and granted" : "Standard priority maintained",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Emergency review failed");
      }

      showNotification(
        action === "APPROVE"
          ? "Priority Approved! Token promoted to #1 in queue."
          : "Priority Rejected. Queue order maintained.",
        "success"
      );
      await fetchAdminData();
    } catch (err: any) {
      showNotification(err.message || "Failed to process emergency review", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Generate Gemini Operational Report
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "REPORT" }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setAiReport(data.report);
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Seed Demo Data
  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEED_DEMO" }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("Seeded Benchmark Queues & Tokens (A #1, B #2, C #3, D #4)", "success");
        await fetchAdminData();
      }
    } catch (err: any) {
      showNotification("Failed to seed demo data", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const pendingEmergencies = emergencyRequests.filter((e) => e.status === "PENDING");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Admin Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            System Operations Command
          </span>
          <h1 className="text-xl font-mono font-bold tracking-tight text-white mt-0.5">
            Administrator Control Cockpit
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSeedDemo}
            isLoading={isSeeding}
            icon={<Database className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Seed Demo Data
          </Button>
          <ConnectionBadge state={connectionState} />
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-mono flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-emerald-950/70 border-emerald-700 text-emerald-200"
              : "bg-red-950/70 border-red-700 text-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-850 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
            activeTab === "overview"
              ? "bg-zinc-100 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab("emergencies")}
          className={`px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors relative flex items-center gap-1.5 ${
            activeTab === "emergencies"
              ? "bg-zinc-100 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <span>Priority Reviews</span>
          {pendingEmergencies.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
              {pendingEmergencies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tokens")}
          className={`px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
            activeTab === "tokens"
              ? "bg-zinc-100 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          Active Tokens ({tokens.filter((t) => t.status === "WAITING" || t.status === "CALLED").length})
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
            activeTab === "analytics"
              ? "bg-zinc-100 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          Analytics & AI Reports
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Total Waiting Queue
              </span>
              <div className="font-mono text-3xl font-bold text-white mt-1">
                {analytics?.waitingCount ?? 0}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Across {queues.length} service departments
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Active Counters
              </span>
              <div className="font-mono text-3xl font-bold text-emerald-400 mt-1">
                {analytics?.activeCountersCount ?? 0} / {counters.length}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                {analytics?.pausedCountersCount ?? 0} counter(s) on break
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Average Wait
              </span>
              <div className="font-mono text-3xl font-bold text-zinc-100 mt-1">
                ~{analytics?.averageWaitMins ?? 0}m
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Avg service: ~{analytics?.averageServiceMins ?? 0}m
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Counter Utilization
              </span>
              <div className="font-mono text-3xl font-bold text-blue-400 mt-1">
                {analytics?.counterUtilizationPct ?? 0}%
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Throughput rate
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Live Queues Overview */}
            <div className="lg:col-span-7 space-y-4">
              <Panel title="Service Queues Status" subtitle="Realtime load across institutional departments">
                <div className="space-y-3">
                  {queues.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">
                            [{q.code}] {q.name}
                          </span>
                          <StatusBadge status={q.status} />
                        </div>
                        <span className="text-xs text-zinc-400">{q.department}</span>
                      </div>

                      <div className="flex items-center gap-4 text-right font-mono">
                        <div>
                          <span className="text-lg font-bold text-emerald-400">
                            {q.waitingCount}
                          </span>
                          <span className="text-[10px] text-zinc-500 block uppercase">Waiting</span>
                        </div>
                        <div className="border-l border-zinc-800 pl-3">
                          <span className="text-sm font-semibold text-zinc-300">
                            ~{q.estimatedServiceTime}m
                          </span>
                          <span className="text-[10px] text-zinc-500 block uppercase">Avg Pace</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Counters Overview */}
            <div className="lg:col-span-5 space-y-4">
              <Panel title="Workstation Counters" subtitle="Active operator assignments & capacity">
                <div className="space-y-2.5">
                  {counters.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-zinc-200 text-xs block">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {c.operatorName} • {c.queue?.name || "General"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {c.currentServingToken && (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 font-mono text-xs font-bold text-emerald-300">
                            {c.currentServingToken.displayNumber}
                          </span>
                        )}
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY REVIEW */}
      {activeTab === "emergencies" && (
        <div className="space-y-4">
          <Panel
            title="Priority Review Requests"
            subtitle="Authoritative administrative review for emergency queue promotions"
            badge={
              <span className="px-2 py-0.5 rounded bg-red-950 border border-red-800 text-[10px] font-mono text-red-300">
                {pendingEmergencies.length} PENDING
              </span>
            }
          >
            <div className="space-y-4">
              {emergencyRequests.length > 0 ? (
                emergencyRequests.map((req) => {
                  const isPending = req.status === "PENDING";
                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPending
                          ? "border-red-600/70 bg-red-950/20"
                          : "border-zinc-800 bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-850">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xl font-bold text-white tracking-wider">
                            {req.token?.displayNumber}
                          </span>
                          <span className="text-xs text-zinc-300 font-medium">
                            {req.token?.visitorName}
                          </span>
                          <span className="text-xs font-mono text-zinc-500">
                            [{req.token?.queue?.code}] {req.token?.queue?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-400">
                            Current Pos: #{req.token?.position}
                          </span>
                          <StatusBadge
                            status={
                              req.status === "APPROVED"
                                ? "EMERGENCY"
                                : req.status === "REJECTED"
                                ? "CANCELLED"
                                : "WAITING"
                            }
                          />
                        </div>
                      </div>

                      <div className="py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                          Visitor Statement & Justification:
                        </span>
                        <p className="text-xs text-zinc-200 bg-zinc-950 p-2.5 rounded border border-zinc-800">
                          {req.reason}
                        </p>
                      </div>

                      {isPending ? (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReviewEmergency(req.id, "REJECT")}
                            isLoading={actionLoading === `${req.id}_REJECT`}
                            icon={<XCircle className="w-3.5 h-3.5 text-zinc-400" />}
                          >
                            Reject Request
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReviewEmergency(req.id, "APPROVE")}
                            isLoading={actionLoading === `${req.id}_APPROVE`}
                            icon={<ShieldAlert className="w-3.5 h-3.5" />}
                          >
                            Approve & Promote to #1
                          </Button>
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-850 flex items-center justify-between">
                          <span>Reviewed by: {req.reviewedBy || "Admin"}</span>
                          <span>
                            {req.reviewedAt
                              ? new Date(req.reviewedAt).toLocaleTimeString()
                              : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs font-mono text-zinc-500">
                  No emergency requests on record.
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 3: ACTIVE TOKENS */}
      {activeTab === "tokens" && (
        <Panel title="Active Tokens Directory" subtitle="Authoritative list of all issued queue tokens">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">TOKEN</th>
                  <th className="py-2.5 px-3">QUEUE</th>
                  <th className="py-2.5 px-3">VISITOR</th>
                  <th className="py-2.5 px-3">PURPOSE</th>
                  <th className="py-2.5 px-3">POS</th>
                  <th className="py-2.5 px-3">ISSUED</th>
                  <th className="py-2.5 px-3 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {tokens.map((token) => (
                  <tr key={token.id} className="hover:bg-zinc-900/50">
                    <td className="py-3 px-3 font-bold text-white tracking-wider">
                      {token.displayNumber}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      [{token.queue?.code}] {token.queue?.name}
                    </td>
                    <td className="py-3 px-3 text-zinc-200">{token.visitorName}</td>
                    <td className="py-3 px-3 text-zinc-400 max-w-[150px] truncate">
                      {token.purpose}
                    </td>
                    <td className="py-3 px-3 font-bold text-zinc-300">
                      {token.position > 0 ? `#${token.position}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-zinc-500">
                      {new Date(token.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <StatusBadge
                        status={
                          token.priority === "EMERGENCY"
                            ? "EMERGENCY"
                            : token.status
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB 4: ANALYTICS & GEMINI REPORTING */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* AI Grounded Reporting Card */}
          <Panel
            title="Institutional Operational Intelligence"
            subtitle="Grounded report synthesized from live queue metrics via Gemini AI"
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateReport}
                isLoading={isGeneratingReport}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Generate Grounded Assessment
              </Button>
            }
          >
            {aiReport ? (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/60">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                    Executive Summary
                  </span>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {aiReport.executiveSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Congestion & Queue Flow
                    </span>
                    <p className="text-xs text-zinc-300">
                      {aiReport.congestionAnalysis}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Workstation Counter Efficiency
                    </span>
                    <p className="text-xs text-zinc-300">
                      {aiReport.counterEfficiency}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block mb-2">
                    Actionable Recommendations
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {aiReport.recommendations?.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-mono">▸</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-mono text-zinc-500">
                Click &quot;Generate Grounded Assessment&quot; to synthesize operational insights from live queue events.
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
