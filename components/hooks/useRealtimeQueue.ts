"use client";

import { useEffect, useState, useRef } from "react";
import { QueueEventPayload } from "@/lib/realtime/events";

export type ConnectionState = "CONNECTED" | "RECONNECTING" | "OFFLINE";

interface UseRealtimeQueueOptions {
  onEvent?: (event: QueueEventPayload) => void;
  onReconcile?: () => Promise<void> | void;
  channel?: string;
  tokenId?: string;
  counterId?: string;
}

export function useRealtimeQueue(options: UseRealtimeQueueOptions = {}) {
  const { onEvent, onReconcile, channel, tokenId, counterId } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>("CONNECTED");
  const [lastEvent, setLastEvent] = useState<QueueEventPayload | null>(null);

  const onEventRef = useRef(onEvent);
  const onReconcileRef = useRef(onReconcile);
  const lastSequenceIdRef = useRef<number>(0);
  const isReconnectingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onReconcileRef.current = onReconcile;
  }, [onEvent, onReconcile]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const establishConnection = () => {
      if (isCancelled) return;

      const params = new URLSearchParams();
      if (channel) params.append("channel", channel);
      if (tokenId) params.append("tokenId", tokenId);
      if (counterId) params.append("counterId", counterId);
      if (lastSequenceIdRef.current > 0) {
        params.append("lastSequenceId", lastSequenceIdRef.current.toString());
      }

      eventSource = new EventSource(`/api/realtime?${params.toString()}`);

      eventSource.onopen = () => {
        if (isCancelled) return;
        setConnectionState("CONNECTED");
        if (isReconnectingRef.current) {
          isReconnectingRef.current = false;
          // Trigger debounced reconciliation
          if (onReconcileRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              onReconcileRef.current?.();
            }, 100);
          }
        }
      };

      eventSource.onmessage = (e) => {
        if (isCancelled) return;
        try {
          if (!e.data || e.data.trim() === "" || e.data.startsWith(":")) return;
          const payload: QueueEventPayload = JSON.parse(e.data);
          if (payload.sequenceId) {
            lastSequenceIdRef.current = Math.max(lastSequenceIdRef.current, payload.sequenceId);
          }
          setLastEvent(payload);

          // Debounce event callback to prevent render thrashing
          if (onEventRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              onEventRef.current?.(payload);
            }, 80);
          }
        } catch {
          // heartbeat ignore
        }
      };

      eventSource.onerror = () => {
        if (isCancelled) return;
        isReconnectingRef.current = true;
        setConnectionState("RECONNECTING");
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            establishConnection();
          }, 3000);
        }
      };
    };

    establishConnection();

    return () => {
      isCancelled = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [channel, tokenId, counterId]);

  return {
    connectionState,
    lastEvent,
    isOnline: connectionState === "CONNECTED",
  };
}
