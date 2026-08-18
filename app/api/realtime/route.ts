import { NextRequest } from "next/server";
import { realtimeBus, QueueEventPayload } from "@/lib/realtime/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lastSequenceIdStr = searchParams.get("lastSequenceId");
  const lastSequenceId = lastSequenceIdStr ? parseInt(lastSequenceIdStr, 10) : 0;
  const channel = searchParams.get("channel");
  const filterTokenId = searchParams.get("tokenId");
  const filterCounterId = searchParams.get("counterId");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connected handshake
      const initialPayload = {
        type: "CONNECTED",
        sequenceId: realtimeBus.getLatestSequenceId(),
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

      // If client is reconnecting with an older sequenceId, replay missed events
      if (lastSequenceId > 0) {
        const missed = realtimeBus.getEventsSince(lastSequenceId);
        for (const evt of missed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        }
      }

      // Subscribe to live event bus
      const unsubscribe = realtimeBus.subscribe((event: QueueEventPayload) => {
        // Optional client filtering
        if (filterTokenId && event.tokenId && event.tokenId !== filterTokenId) {
          // Allow general queue changes (like cancelled/promoted) to update positions even if tokenId differs
          if (event.type !== "TOKEN_CANCELLED" && event.type !== "EMERGENCY_PROMOTED" && event.type !== "TOKEN_CALLED") {
            return;
          }
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (err) {
          // Stream closed
          unsubscribe();
        }
      });

      // Keep-alive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 15000);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
