import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  callNextToken,
  recallToken,
  markNoShow,
  transferToken,
  toggleCounterPause,
  completeServing,
} from "@/lib/queue/engine";
import { CounterActionSchema } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counters = await prisma.counter.findMany({
      include: {
        queue: true,
      },
      orderBy: { number: "asc" },
    });

    const activeTokenIds = counters
      .map((c) => c.currentServingTokenId)
      .filter((id): id is string => Boolean(id));

    const activeTokens =
      activeTokenIds.length > 0
        ? await prisma.token.findMany({
            where: { id: { in: activeTokenIds } },
            include: { queue: true },
          })
        : [];

    const tokenMap = new Map(activeTokens.map((t) => [t.id, t]));

    const enrichedCounters = counters.map((c) => ({
      ...c,
      currentServingToken: c.currentServingTokenId
        ? tokenMap.get(c.currentServingTokenId) || null
        : null,
    }));

    return NextResponse.json({ success: true, counters: enrichedCounters });
  } catch (err: any) {
    console.error("Error fetching counters:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch counters" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CounterActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || "Invalid counter action" },
        { status: 400 }
      );
    }

    const { counterId, action, operatorName, targetQueueId, specificTokenId } = parsed.data;

    switch (action) {
      case "CALL_NEXT": {
        const result = await callNextToken(counterId, operatorName, targetQueueId, specificTokenId);
        if (!result) {
          return NextResponse.json({
            success: true,
            emptyQueue: true,
            message: "No waiting tokens in the selected queue.",
          });
        }
        return NextResponse.json({ success: true, ...result });
      }

      case "ASSIGN_QUEUE": {
        const updated = await prisma.counter.update({
          where: { id: counterId },
          data: { queueId: targetQueueId || null },
          include: { queue: true },
        });
        return NextResponse.json({ success: true, counter: updated });
      }

      case "COMPLETE":
      case "COMPLETE_SERVING": {
        const result = await completeServing(counterId, operatorName);
        return NextResponse.json({ success: true, ...result });
      }

      case "RECALL": {
        const result = await recallToken(counterId);
        return NextResponse.json({ success: true, ...result });
      }

      case "NO_SHOW": {
        const result = await markNoShow(counterId);
        return NextResponse.json({ success: true, ...result });
      }

      case "TRANSFER": {
        if (!targetQueueId) {
          return NextResponse.json(
            { success: false, error: "Target queue ID required for transfer" },
            { status: 400 }
          );
        }
        const counter = await prisma.counter.findUnique({ where: { id: counterId } });
        if (!counter || !counter.currentServingTokenId) {
          return NextResponse.json(
            { success: false, error: "No active token being served to transfer" },
            { status: 400 }
          );
        }
        const result = await transferToken({
          tokenId: counter.currentServingTokenId,
          targetQueueId,
          actor: operatorName || counter.operatorName,
        });
        return NextResponse.json({ success: true, token: result });
      }

      case "PAUSE": {
        const counter = await toggleCounterPause(counterId, true);
        return NextResponse.json({ success: true, counter });
      }

      case "RESUME": {
        const counter = await toggleCounterPause(counterId, false);
        return NextResponse.json({ success: true, counter });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Error performing counter action:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Counter operation failed" },
      { status: 400 }
    );
  }
}
