"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  Activity,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  LayoutDashboard,
  Layers,
  Search,
  Database,
  ArrowUpRight,
  ArrowDown,
  Trash2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { useRealtimeQueue } from "@/components/hooks/useRealtimeQueue";

export default function AdminCockpitPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "emergency" | "tokens" | "analytics">("overview");
  const [queues, setQueues] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [tokenSearch, setTokenSearch] = useState<string>("");
  const [tokenQueueFilter, setTokenQueueFilter] = useState<string>("ALL");

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Authoritative State Fetcher
  const fetchAdminData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [qRes, cRes, tRes, eRes, aRes] = await Promise.allSettled([
        fetch("/api/queues", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/counters", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/tokens", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/emergency", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/analytics", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (qRes.status === "fulfilled" && qRes.value.success) setQueues(qRes.value.queues || []);
      if (cRes.status === "fulfilled" && cRes.value.success) setCounters(cRes.value.counters || []);
      if (tRes.status === "fulfilled" && tRes.value.success) setTokens(tRes.value.tokens || []);
      if (eRes.status === "fulfilled" && eRes.value.success) setEmergencyRequests(eRes.value.requests || []);
      if (aRes.status === "fulfilled" && aRes.value.success) setAnalytics(aRes.value.metrics || null);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setIsLoading(false);
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Realtime hook - receives all events globally
  const { connectionState } = useRealtimeQueue({
    onEvent: () => {
      fetchAdminData(true);
    },
    onReconcile: () => {
      fetchAdminData(true);
    },
  });

  // 3-second auto-polling fallback for live sync
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAdminData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  // Formal Emergency Request Approval / Rejection
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
      await fetchAdminData(true);
    } catch (err: any) {
      showNotification(err.message || "Failed to process emergency review", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Direct Admin Emergency Override (Promote or Demote Any Token)
  const handleDirectPriorityToggle = async (tokenId: string, setEmergency: boolean) => {
    setActionLoading(`priority_${tokenId}`);
    try {
      const res = await fetch("/api/emergency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          action: setEmergency ? "DIRECT_PROMOTE" : "DIRECT_DEMOTE",
          reviewer: "System Administrator",
          notes: setEmergency ? "Direct priority grant by Admin" : "Demoted to standard priority",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update token priority");
      }

      showNotification(data.message || "Priority updated successfully!", "success");
      await fetchAdminData(true);
    } catch (err: any) {
      showNotification(err.message || "Failed to modify priority", "error");
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
        await fetchAdminData(true);
      }
    } catch (err: any) {
      showNotification("Failed to seed demo data", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const pendingEmergencies = emergencyRequests.filter((e) => e.status === "PENDING");

  // Filter tokens for directory
  const filteredTokens = tokens.filter((t) => {
    const matchesSearch =
      tokenSearch.trim() === "" ||
      t.displayNumber.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      t.visitorName.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      t.purpose.toLowerCase().includes(tokenSearch.toLowerCase());

    const matchesQueue =
      tokenQueueFilter === "ALL" || t.queueId === tokenQueueFilter;

    return matchesSearch && matchesQueue;
  });

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4 sm:pb-6">
        <div>
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-zinc-500">
            Administrative Operations Cockpit
          </span>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            System Control & Telemetry
            {isRefreshing && (
              <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDemo}
            isLoading={isSeeding}
            icon={<Database className="w-3.5 h-3.5 text-blue-400" />}
            className="border-zinc-800 font-mono text-xs"
          >
            Seed Demo Benchmarks
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAdminData(false)}
            isLoading={isRefreshing}
            className="border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Sync
          </Button>

          <ConnectionBadge state={connectionState} />
        </div>
      </div>

      {/* Action Notification Toast */}
      {notification && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs font-mono flex items-center gap-2 transition-all shadow-lg ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : "bg-red-950/90 border-red-700 text-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-mono font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "overview"
              ? "border-zinc-100 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> System Overview
        </button>

        <button
          onClick={() => setActiveTab("emergency")}
          className={`px-4 py-2.5 text-xs font-mono font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap relative ${
            activeTab === "emergency"
              ? "border-red-500 text-red-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Emergency Triage
          {pendingEmergencies.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-mono animate-pulse">
              {pendingEmergencies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tokens")}
          className={`px-4 py-2.5 text-xs font-mono font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "tokens"
              ? "border-zinc-100 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Layers className="w-4 h-4" /> Active Tokens ({tokens.length})
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2.5 text-xs font-mono font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "analytics"
              ? "border-zinc-100 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> AI Telemetry & KPIs
        </button>
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Total In System
              </span>
              <div className="mt-1 font-mono text-3xl font-bold text-white">
                {analytics?.totalInSystem || tokens.filter((t) => t.status === "WAITING" || t.status === "CALLED").length}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">Active visitors across queues</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Active Counters
              </span>
              <div className="mt-1 font-mono text-3xl font-bold text-emerald-400">
                {counters.filter((c) => c.status === "AVAILABLE" || c.status === "BUSY").length} / {counters.length}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">Operational workstations</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Emergency Priority
              </span>
              <div className="mt-1 font-mono text-3xl font-bold text-red-400">
                {tokens.filter((t) => t.priority === "EMERGENCY" && t.status === "WAITING").length}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">Active emergency tokens at #1</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Average Wait Time
              </span>
              <div className="mt-1 font-mono text-3xl font-bold text-white">
                ~{analytics?.avgWaitMins || 4}m
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">Dynamic weighted average</span>
            </div>
          </div>

          {/* Department Queues Grid */}
          <div>
            <h2 className="text-sm font-mono uppercase font-bold text-zinc-300 mb-3">
              Department Service Queues
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {queues.map((q) => (
                <Panel
                  key={q.id}
                  title={`[${q.code}] ${q.name}`}
                  subtitle={q.description}
                  badge={
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 font-bold">
                      {q.waitingCount} WAITING
                    </span>
                  }
                >
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                      <span>Est. Service Time:</span>
                      <span className="text-zinc-200 font-bold">{q.estimatedServiceTime} mins</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                      <span>Active Counters:</span>
                      <span className="text-emerald-400 font-bold">{q.activeCounters || 1} online</span>
                    </div>

                    {/* Waiting Tokens List in Queue */}
                    <div className="mt-3 pt-3 border-t border-zinc-850 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                        Top Waiting Tokens:
                      </span>
                      {q.waitingTokens && q.waitingTokens.length > 0 ? (
                        q.waitingTokens.slice(0, 4).map((t: any) => (
                          <div
                            key={t.id}
                            className={`flex items-center justify-between p-2 rounded bg-zinc-900 border text-xs font-mono ${
                              t.priority === "EMERGENCY"
                                ? "border-red-700 bg-red-950/30 text-red-200"
                                : "border-zinc-800 text-zinc-300"
                            }`}
                          >
                            <span className="font-bold">
                              #{t.position} {t.displayNumber}
                            </span>
                            <span className="text-[11px] text-zinc-400 truncate max-w-[120px]">
                              {t.visitorName}
                            </span>
                            {t.priority === "EMERGENCY" ? (
                              <span className="px-1 py-0.2 rounded bg-red-900 text-[9px] text-red-200">
                                EMERGENCY
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDirectPriorityToggle(t.id, true)}
                                className="text-[10px] text-red-400 hover:text-red-300 hover:underline"
                                title="Promote to Emergency"
                              >
                                Escalate
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-zinc-500 italic py-2">No visitors waiting</div>
                      )}
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY TRIAGE */}
      {activeTab === "emergency" && (
        <div className="space-y-6">
          <Panel
            title="Emergency Priority Review Panel"
            subtitle="Adjudicate visitor escalation requests. Approved requests move atomically to position #1 across the queue."
            badge={
              <span className="px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300 text-[10px] font-mono font-bold">
                {pendingEmergencies.length} PENDING REVIEW
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

      {/* TAB 3: ACTIVE TOKENS DIRECTORY & DIRECT PRIORITY OVERRIDE */}
      {activeTab === "tokens" && (
        <Panel
          title="Active Tokens Directory & Priority Controls"
          subtitle="Authoritative list of all issued tokens. Promote or demote any token priority with instant re-indexing."
          badge={
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 font-bold">
              {filteredTokens.length} MATCHING
            </span>
          }
        >
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search token #, visitor name, purpose..."
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Queue:</span>
              <select
                value={tokenQueueFilter}
                onChange={(e) => setTokenQueueFilter(e.target.value)}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
              >
                <option value="ALL">All Queues</option>
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    [{q.code}] {q.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">TOKEN</th>
                  <th className="py-2.5 px-3">QUEUE</th>
                  <th className="py-2.5 px-3">VISITOR</th>
                  <th className="py-2.5 px-3">PURPOSE</th>
                  <th className="py-2.5 px-3">POS</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3 text-right">PRIORITY OVERRIDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredTokens.length > 0 ? (
                  filteredTokens.map((token) => {
                    const isWaiting = token.status === "WAITING";
                    const isEmergency = token.priority === "EMERGENCY";

                    return (
                      <tr key={token.id} className="hover:bg-zinc-900/50 transition-colors">
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
                        <td className="py-3 px-3">
                          <StatusBadge
                            status={
                              token.priority === "EMERGENCY"
                                ? "EMERGENCY"
                                : token.status
                            }
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isWaiting && (
                            <div className="flex items-center justify-end gap-1.5">
                              {isEmergency ? (
                                <Button
                                  variant="warning"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] font-mono"
                                  onClick={() => handleDirectPriorityToggle(token.id, false)}
                                  isLoading={actionLoading === `priority_${token.id}`}
                                  icon={<ArrowDown className="w-3 h-3" />}
                                >
                                  Demote to Standard
                                </Button>
                              ) : (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] font-mono"
                                  onClick={() => handleDirectPriorityToggle(token.id, true)}
                                  isLoading={actionLoading === `priority_${token.id}`}
                                  icon={<ShieldAlert className="w-3 h-3" />}
                                >
                                  Promote to #1
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono">
                      No matching tokens found.
                    </td>
                  </tr>
                )}
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
                icon={<Sparkles className="w-3.5 h-3.5 text-emerald-300" />}
              >
                Generate Grounded Report
              </Button>
            }
          >
            {aiReport ? (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">
                {aiReport}
              </div>
            ) : (
              <div className="py-12 text-center text-xs font-mono text-zinc-500">
                Click &quot;Generate Grounded Report&quot; to synthesize multi-source telemetry into an executive brief.
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
