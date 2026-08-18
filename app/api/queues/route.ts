import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seedRealisticDemoData } from "@/lib/queue/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const queues = await prisma.queue.findMany({
      include: {
        counters: true,
        tokens: {
          where: {
            status: "WAITING",
          },
          orderBy: [
            { priority: "desc" },
            { position: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
      orderBy: { code: "asc" },
    });

    const formatted = queues.map((q) => ({
      id: q.id,
      name: q.name,
      code: q.code,
      department: q.department,
      description: q.description,
      status: q.status,
      estimatedServiceTime: q.estimatedServiceTime,
      waitingCount: q.tokens.length,
      activeCounters: q.counters.filter((c) => c.status !== "PAUSED" && c.status !== "CLOSED").length,
      waitingTokens: q.tokens.map((t) => ({
        id: t.id,
        displayNumber: t.displayNumber,
        position: t.position,
        priority: t.priority,
        visitorName: t.visitorName,
        purpose: t.purpose,
        createdAt: t.createdAt,
      })),
    }));

    return NextResponse.json({ success: true, queues: formatted });
  } catch (err: any) {
    console.error("Error fetching queues:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch queues" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "SEED_DEMO") {
      const result = await seedRealisticDemoData();
      return NextResponse.json({
        success: true,
        message: "Realistic demo data seeded successfully (A #1, B #2, C #3, D #4)",
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error executing queue action:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to seed demo data" },
      { status: 500 }
    );
  }
}
