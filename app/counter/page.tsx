"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PhoneCall,
  RotateCcw,
  UserX,
  ArrowRightLeft,
  Pause,
  Play,
  Monitor,
  Users,
  Clock,
  ShieldAlert,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Check,
  RefreshCw,
  Filter,
  ArrowUpRight,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { useRealtimeQueue } from "@/components/hooks/useRealtimeQueue";

interface CounterDetail {
  id: string;
  number: number;
  name: string;
  queueId: string | null;
  status: "AVAILABLE" | "BUSY" | "PAUSED" | "CLOSED";
  operatorName: string;
  currentServingTokenId: string | null;
  currentServingToken: any | null;
  queue: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface WaitingToken {
  id: string;
  displayNumber: string;
  position: number;
  priority: string;
  visitorName: string;
  purpose: string;
  createdAt: string;
  queueId?: string;
  queueCode?: string;
  queueName?: string;
}

export default function CounterConsolePage() {
  const [counters, setCounters] = useState<CounterDetail[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>("");
  const [allQueues, setAllQueues] = useState<any[]>([]);
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>("ALL"); // "ALL" | "ASSIGNED" | specific queueId
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAssignQueueModalOpen, setIsAssignQueueModalOpen] = useState(false);
  const [targetTransferQueueId, setTargetTransferQueueId] = useState("");
  const [targetAssignQueueId, setTargetAssignQueueId] = useState("");

  const showNotification = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch counters and queue state resiliently
  const fetchWorkstationState = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [countersRes, queuesRes] = await Promise.allSettled([
        fetch("/api/counters", { cache: "no-store" }),
        fetch("/api/queues", { cache: "no-store" }),
      ]);

      if (countersRes.status === "fulfilled" && countersRes.value.ok) {
        const countersData = await countersRes.value.json();
        if (countersData.success && Array.isArray(countersData.counters)) {
          setCounters(countersData.counters);
          setSelectedCounterId((prev) => {
            if (!prev && countersData.counters.length > 0) {
              return countersData.counters[0].id;
            }
            if (prev && !countersData.counters.some((c: any) => c.id === prev)) {
              return countersData.counters[0]?.id || "";
            }
            return prev;
          });
        }
      }

      if (queuesRes.status === "fulfilled" && queuesRes.value.ok) {
        const queuesData = await queuesRes.value.json();
        if (queuesData.success && Array.isArray(queuesData.queues)) {
          setAllQueues(queuesData.queues);
        }
      }
    } catch (err) {
      console.error("Failed to load counter workstation state:", err);
    } finally {
      setIsLoading(false);
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkstationState();
  }, [fetchWorkstationState]);

  // Real-time synchronization event listener
  const { connectionState } = useRealtimeQueue({
    onEvent: () => {
      fetchWorkstationState(true);
    },
    onReconcile: () => {
      fetchWorkstationState(true);
    },
  });

  // Fast 2.5-second background polling fallback to guarantee 100% sync
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWorkstationState(true);
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchWorkstationState]);

  const currentCounter = useMemo(
    () => counters.find((c) => c.id === selectedCounterId) || counters[0] || null,
    [counters, selectedCounterId]
  );

  const currentToken = currentCounter?.currentServingToken || null;

  // Flatten and compute all waiting tokens across all categories
  const allWaitingTokens: WaitingToken[] = useMemo(() => {
    if (!allQueues || allQueues.length === 0) return [];
    return allQueues.flatMap((q) =>
      (q.waitingTokens || []).map((t: any) => ({
        ...t,
        queueId: q.id,
        queueCode: q.code,
        queueName: q.name,
      }))
    );
  }, [allQueues]);

  // Dynamically compute waiting tokens for the active filter view
  const waitingTokens: WaitingToken[] = useMemo(() => {
    let list = [...allWaitingTokens];

    if (selectedQueueFilter === "ASSIGNED") {
      if (currentCounter?.queueId) {
        list = list.filter((t) => t.queueId === currentCounter.queueId);
      }
    } else if (selectedQueueFilter !== "ALL") {
      list = list.filter((t) => t.queueId === selectedQueueFilter);
    }

    // Sort EMERGENCY priority first, then position ascending, then arrival time
    return list.sort((a, b) => {
      const aPri = a.priority === "EMERGENCY" ? 1 : 0;
      const bPri = b.priority === "EMERGENCY" ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
      if (a.position !== b.position) return a.position - b.position;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [allWaitingTokens, selectedQueueFilter, currentCounter]);

  // Execute Workstation Action
  const handleCounterAction = async (action: string, extraBody: any = {}) => {
    if (!currentCounter) return;

    setActionLoading(action);

    // Optimistic UI updates
    if (action === "COMPLETE" || action === "COMPLETE_SERVING" || action === "NO_SHOW") {
      setCounters((prev) =>
        prev.map((c) =>
          c.id === currentCounter.id
            ? { ...c, status: "AVAILABLE", currentServingTokenId: null, currentServingToken: null }
            : c
        )
      );
    } else if (action === "PAUSE") {
      setCounters((prev) =>
        prev.map((c) => (c.id === currentCounter.id ? { ...c, status: "PAUSED" } : c))
      );
    } else if (action === "RESUME") {
      setCounters((prev) =>
        prev.map((c) => (c.id === currentCounter.id ? { ...c, status: "AVAILABLE" } : c))
      );
    }

    try {
      const res = await fetch("/api/counters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterId: currentCounter.id,
          action,
          operatorName: currentCounter.operatorName,
          ...extraBody,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to execute ${action}`);
      }

      if (action === "CALL_NEXT") {
        if (data.emptyQueue) {
          showNotification("No waiting visitors in this queue.", "info");
        } else {
          showNotification(`Called Token ${data.token?.displayNumber} to ${currentCounter.name}`, "success");
        }
      } else if (action === "COMPLETE" || action === "COMPLETE_SERVING") {
        showNotification(`Completed service for Token ${currentToken?.displayNumber || ""}`, "success");
      } else if (action === "RECALL") {
        showNotification(`Recalled Token ${currentToken?.displayNumber}`, "info");
      } else if (action === "NO_SHOW") {
        showNotification(`Marked Token ${currentToken?.displayNumber} as No-Show`, "error");
      } else if (action === "PAUSE") {
        showNotification(`${currentCounter.name} is now Paused`, "info");
      } else if (action === "RESUME") {
        showNotification(`${currentCounter.name} is now Active`, "success");
      } else if (action === "TRANSFER") {
        showNotification(`Transferred Token to target queue`, "success");
        setIsTransferModalOpen(false);
      } else if (action === "ASSIGN_QUEUE") {
        showNotification(`Assigned ${currentCounter.name} to ${data.counter?.queue?.name || "General (All Queues)"}`, "success");
        setIsAssignQueueModalOpen(false);
      }

      await fetchWorkstationState(true);
    } catch (err: any) {
      showNotification(err.message || "Operation failed", "error");
      await fetchWorkstationState(true);
    } finally {
      setActionLoading(null);
    }
  };

  const callNextInScope = () => {
    const targetQueueId =
      selectedQueueFilter === "ALL"
        ? null
        : selectedQueueFilter === "ASSIGNED"
        ? currentCounter?.queueId
        : selectedQueueFilter;

    handleCounterAction("CALL_NEXT", { targetQueueId });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        callNextInScope();
      } else if ((e.key.toLowerCase() === "c" || e.code === "Space") && currentToken) {
        e.preventDefault();
        handleCounterAction("COMPLETE");
      } else if (e.key.toLowerCase() === "r" && currentToken) {
        e.preventDefault();
        handleCounterAction("RECALL");
      } else if (e.key.toLowerCase() === "n" && currentToken) {
        e.preventDefault();
        handleCounterAction("NO_SHOW");
      } else if (e.key.toLowerCase() === "t" && currentToken) {
        e.preventDefault();
        setIsTransferModalOpen(true);
      } else if (e.key.toLowerCase() === "p" && currentCounter) {
        e.preventDefault();
        if (currentCounter.status === "PAUSED") {
          handleCounterAction("RESUME");
        } else {
          handleCounterAction("PAUSE");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCounter, currentToken, selectedQueueFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Workstation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Institutional Operations Terminal
          </span>
          <h1 className="text-xl font-mono font-bold tracking-tight text-white mt-0.5 flex items-center gap-2">
            Counter Workstation Console
            {isRefreshing && (
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Counter Switcher Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            {counters.map((c) => {
              const isSelected = (currentCounter?.id || selectedCounterId) === c.id;
              const hasActive = Boolean(c.currentServingTokenId);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCounterId(c.id)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      c.status === "PAUSED"
                        ? "bg-amber-500"
                        : hasActive
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-zinc-600"
                    }`}
                  />
                  {c.name}
                  {c.queue?.code && (
                    <span className={`text-[10px] px-1 rounded ${isSelected ? "bg-zinc-300 text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}>
                      {c.queue.code}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWorkstationState(false)}
            isLoading={isRefreshing}
            className="h-8 border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Sync
          </Button>

          <ConnectionBadge state={connectionState} />
        </div>
      </div>

      {/* Action Notification Toast */}
      {notification && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-mono flex items-center gap-2 transition-all shadow-lg ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : notification.type === "error"
              ? "bg-red-950/90 border-red-700 text-red-200"
              : "bg-zinc-900/90 border-zinc-700 text-zinc-200"
          }`}
        >
          {notification.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          {notification.type === "error" && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {currentCounter ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Serving Workstation Area */}
          <div className="lg:col-span-6 space-y-6">
            <Panel
              title={currentCounter.name}
              subtitle={`Operator: ${currentCounter.operatorName} • Assigned: ${
                currentCounter.queue?.name || "General (All Departments)"
              }`}
              badge={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTargetAssignQueueId(currentCounter.queueId || "");
                      setIsAssignQueueModalOpen(true);
                    }}
                    className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px] font-mono flex items-center gap-1"
                    title="Change counter assignment"
                  >
                    <Settings className="w-3 h-3" /> Reassign
                  </button>
                  <StatusBadge status={currentCounter.status} />
                </div>
              }
            >
              {currentToken ? (
                <div className="space-y-6 py-2">
                  <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-emerald-900/60 bg-emerald-950/20 shadow-inner">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold mb-1">
                      CURRENT SERVING CALL
                    </span>
                    <div className="font-mono text-6xl font-extrabold tracking-wider text-white my-2">
                      {currentToken.displayNumber}
                    </div>
                    <span className="text-lg font-semibold text-zinc-100 mt-1">
                      {currentToken.visitorName}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 mt-0.5">
                      Purpose: {currentToken.purpose}
                    </span>
                    <div className="mt-3 flex items-center gap-2">
                      <StatusBadge status={currentToken.priority === "EMERGENCY" ? "EMERGENCY" : "SERVING"} />
                      {currentToken.queue?.name && (
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                          {currentToken.queue.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Finish / Complete Serving Action */}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-sm py-4 shadow-lg shadow-emerald-950/50"
                    onClick={() => handleCounterAction("COMPLETE")}
                    isLoading={actionLoading === "COMPLETE"}
                    icon={<Check className="w-5 h-5" />}
                  >
                    COMPLETE SERVING <span className="text-xs font-mono ml-2 opacity-80">[C]</span>
                  </Button>

                  {/* Secondary Action Controls */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCounterAction("RECALL")}
                      isLoading={actionLoading === "RECALL"}
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Recall <span className="text-[9px] text-zinc-500 ml-1 font-mono">[R]</span>
                    </Button>

                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => handleCounterAction("NO_SHOW")}
                      isLoading={actionLoading === "NO_SHOW"}
                      icon={<UserX className="w-3.5 h-3.5" />}
                    >
                      No-Show <span className="text-[9px] text-amber-500 ml-1 font-mono">[N]</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsTransferModalOpen(true)}
                      icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                    >
                      Transfer <span className="text-[9px] text-zinc-500 ml-1 font-mono">[T]</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950 space-y-3">
                  <Monitor className="w-10 h-10 text-zinc-600" />
                  <span className="text-sm font-mono uppercase font-bold text-zinc-300">
                    Counter Ready & Available
                  </span>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Press <strong className="text-zinc-200">CALL NEXT VISITOR</strong> to serve the next ticket in queue, or click <strong>CALL</strong> on any specific waiting visitor.
                  </p>
                </div>
              )}

              {/* Call Next Button */}
              <div className="mt-6 pt-4 border-t border-zinc-850 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full text-base py-4 font-mono font-bold"
                  onClick={callNextInScope}
                  disabled={currentCounter.status === "PAUSED"}
                  isLoading={actionLoading === "CALL_NEXT"}
                  icon={<PhoneCall className="w-5 h-5" />}
                >
                  CALL NEXT VISITOR{" "}
                  <span className="text-xs font-mono ml-2 opacity-75">[Enter]</span>
                </Button>

                <div className="flex items-center justify-between pt-1">
                  {currentCounter.status === "PAUSED" ? (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleCounterAction("RESUME")}
                      isLoading={actionLoading === "RESUME"}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      Resume Workstation [P]
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-500 hover:text-amber-400"
                      onClick={() => handleCounterAction("PAUSE")}
                      isLoading={actionLoading === "PAUSE"}
                      icon={<Pause className="w-3.5 h-3.5" />}
                    >
                      Pause Counter / Break [P]
                    </Button>
                  )}

                  <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" /> Shortcuts: Enter, C, R, N, P, T
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          {/* Right Column: Live Queue Table with Category Filters */}
          <div className="lg:col-span-6 space-y-6">
            <Panel
              title="Next In Queue"
              subtitle={`${waitingTokens.length} waiting visitor(s) matching view`}
              badge={
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                  {allWaitingTokens.length} TOTAL WAITING
                </span>
              }
            >
              {/* Category Filter Scope Selector */}
              <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-zinc-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Scope:
                </span>

                <button
                  onClick={() => setSelectedQueueFilter("ALL")}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                    selectedQueueFilter === "ALL"
                      ? "bg-zinc-100 text-zinc-950 font-bold"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  All Categories ({allWaitingTokens.length})
                </button>

                {currentCounter.queue && (
                  <button
                    onClick={() => setSelectedQueueFilter("ASSIGNED")}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                      selectedQueueFilter === "ASSIGNED"
                        ? "bg-zinc-100 text-zinc-950 font-bold"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    Counter Queue [{currentCounter.queue.code}] (
                    {allWaitingTokens.filter((t) => t.queueId === currentCounter.queueId).length}
                    )
                  </button>
                )}

                {allQueues.map((q) => {
                  const count = allWaitingTokens.filter((t) => t.queueId === q.id).length;
                  const isSelected = selectedQueueFilter === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQueueFilter(q.id)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                        isSelected
                          ? "bg-zinc-100 text-zinc-950 font-bold"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                      }`}
                    >
                      [{q.code}] {count}
                    </button>
                  );
                })}
              </div>

              {/* Waiting Tokens Table */}
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">POS</th>
                      <th className="py-2.5 px-3">TOKEN</th>
                      <th className="py-2.5 px-3">VISITOR</th>
                      <th className="py-2.5 px-3">QUEUE</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {waitingTokens.length > 0 ? (
                      waitingTokens.map((token) => (
                        <tr
                          key={token.id}
                          className={`hover:bg-zinc-900/50 transition-colors ${
                            token.priority === "EMERGENCY"
                              ? "bg-red-950/30 text-red-200"
                              : ""
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-zinc-300">
                            #{token.position}
                          </td>
                          <td className="py-3 px-3 font-bold text-white tracking-wider">
                            {token.displayNumber}
                          </td>
                          <td className="py-3 px-3 text-zinc-300">
                            <div>{token.visitorName}</div>
                            <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                              {token.purpose}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                              [{token.queueCode || "Q"}] {token.queueName || "General"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2.5 text-[10px] font-mono hover:bg-emerald-600 hover:text-white"
                              onClick={() =>
                                handleCounterAction("CALL_NEXT", {
                                  specificTokenId: token.id,
                                })
                              }
                              isLoading={actionLoading === `call_${token.id}`}
                            >
                              Call <ArrowUpRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-zinc-500 font-mono"
                        >
                          No visitors waiting in this category view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-zinc-500 font-mono">
          Loading Counter Workstation...
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-mono uppercase font-bold text-zinc-100">
              Transfer Active Token
            </h3>
            <p className="text-xs text-zinc-400">
              Move Token <strong className="text-white">{currentToken?.displayNumber}</strong> to another service queue:
            </p>

            <select
              value={targetTransferQueueId}
              onChange={(e) => setTargetTransferQueueId(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
            >
              <option value="">Select target queue...</option>
              {allQueues
                .filter((q) => q.id !== currentCounter?.queueId)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    [{q.code}] {q.name}
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTransferModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!targetTransferQueueId}
                onClick={() =>
                  handleCounterAction("TRANSFER", {
                    targetQueueId: targetTransferQueueId,
                  })
                }
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Queue Modal */}
      {isAssignQueueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-mono uppercase font-bold text-zinc-100">
              Reassign {currentCounter?.name}
            </h3>
            <p className="text-xs text-zinc-400">
              Select which department queue this workstation will prioritize:
            </p>

            <select
              value={targetAssignQueueId}
              onChange={(e) => setTargetAssignQueueId(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
            >
              <option value="">General (Handles All Queues)</option>
              {allQueues.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.code}] {q.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAssignQueueModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  handleCounterAction("ASSIGN_QUEUE", {
                    targetQueueId: targetAssignQueueId || null,
                  })
                }
              >
                Save Assignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
