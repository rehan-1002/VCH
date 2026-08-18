export type QueueEventType =
  | "TOKEN_CREATED"
  | "TOKEN_CANCELLED"
  | "EMERGENCY_REQUESTED"
  | "EMERGENCY_PROMOTED"
  | "EMERGENCY_REJECTED"
  | "TOKEN_CALLED"
  | "TOKEN_SERVING"
  | "TOKEN_COMPLETED"
  | "TOKEN_NO_SHOW"
  | "TOKEN_RECALLED"
  | "TOKEN_TRANSFERRED"
  | "COUNTER_PAUSED"
  | "COUNTER_RESUMED";

export interface QueueEventPayload {
  id: string;
  sequenceId: number;
  type: QueueEventType;
  tokenId?: string;
  queueId?: string;
  counterId?: string;
  data: Record<string, any>;
  timestamp: string;
}

type EventSubscriber = (event: QueueEventPayload) => void;

class RealtimeEventBus {
  private subscribers: Set<EventSubscriber> = new Set();
  private recentEvents: QueueEventPayload[] = [];
  private maxHistory = 100;
  private sequenceCounter = 0;

  subscribe(callback: EventSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  publish(
    type: QueueEventType,
    payload: {
      tokenId?: string;
      queueId?: string;
      counterId?: string;
      data?: Record<string, any>;
    }
  ): QueueEventPayload {
    this.sequenceCounter += 1;
    const event: QueueEventPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sequenceId: this.sequenceCounter,
      type,
      tokenId: payload.tokenId,
      queueId: payload.queueId,
      counterId: payload.counterId,
      data: payload.data || {},
      timestamp: new Date().toISOString(),
    };

    // Store in circular buffer for reconnect replay
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxHistory) {
      this.recentEvents.shift();
    }

    // Broadcast to all active SSE subscribers
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error("Error in realtime subscriber callback:", err);
      }
    }

    return event;
  }

  getEventsSince(lastSequenceId: number): QueueEventPayload[] {
    return this.recentEvents.filter((e) => e.sequenceId > lastSequenceId);
  }

  getLatestSequenceId(): number {
    return this.sequenceCounter;
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

// Global singleton to persist across hot-reloads in Next.js development
const globalForEvents = globalThis as unknown as {
  realtimeBus?: RealtimeEventBus;
};

export const realtimeBus = globalForEvents.realtimeBus ?? new RealtimeEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForEvents.realtimeBus = realtimeBus;
}
