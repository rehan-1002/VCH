import { NextRequest, NextResponse } from "next/server";
import { triageVisitorIntent } from "@/lib/ai/cohere";
import { generateOperationalReport } from "@/lib/ai/gemini";
import { calculateOperationalKPIs } from "@/lib/analytics/kpis";
import { sanitizeText } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, prompt } = body;

    if (mode === "TRIAGE") {
      const cleanPrompt = sanitizeText(prompt);
      if (!cleanPrompt) {
        return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
      }
      const suggestions = await triageVisitorIntent(cleanPrompt);
      return NextResponse.json({ success: true, suggestions });
    }

    if (mode === "REPORT") {
      const kpis = await calculateOperationalKPIs();
      const report = await generateOperationalReport({
        totalTokensToday: kpis.totalTokensToday,
        waitingCount: kpis.waitingCount,
        completedCount: kpis.completedCount,
        noShowCount: kpis.noShowCount,
        cancelledCount: kpis.cancelledCount,
        averageWaitMins: kpis.averageWaitMins,
        averageServiceMins: kpis.averageServiceMins,
        activeCountersCount: kpis.activeCountersCount,
        pausedCountersCount: kpis.pausedCountersCount,
        emergencyRequestsCount: kpis.emergencyRequestsCount,
        queueBreakdown: kpis.queueBreakdown,
      });
      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json({ success: false, error: "Invalid AI mode" }, { status: 400 });
  } catch (err: any) {
    console.error("AI API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "AI operation failed" },
      { status: 500 }
    );
  }
}
