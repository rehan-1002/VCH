import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { cancelToken, getActiveCounterCount } from "@/lib/queue/engine";
import { calculateEstimatedWaitTime } from "@/lib/eta/calculator";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
        queue: true,
        counter: true,
        emergencyRequest: true,
      },
    });

    if (!token) {
      return NextResponse.json({ success: false, error: "Token not found" }, { status: 404 });
    }

    // Dynamic ETA recalculation
    const activeCounters = await getActiveCounterCount(token.queueId);
    const estimatedWaitMins = calculateEstimatedWaitTime({
      position: token.position,
      estimatedServiceTimeMins: token.queue.estimatedServiceTime,
      activeCounterCount: activeCounters,
    });

    const peopleAhead = Math.max(0, token.position - 1);

    return NextResponse.json({
      success: true,
      token,
      estimatedWaitMins,
      peopleAhead,
    });
  } catch (err: any) {
    console.error("Error fetching token:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch token" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cancelled = await cancelToken(id);

    return NextResponse.json({
      success: true,
      token: cancelled,
      message: "Token cancelled successfully",
    });
  } catch (err: any) {
    console.error("Error cancelling token:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to cancel token" },
      { status: 400 }
    );
  }
}
