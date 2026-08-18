import { GoogleGenerativeAI } from "@google/generative-ai";

export interface OperationalMetricsInput {
  totalTokensToday: number;
  waitingCount: number;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  averageWaitMins: number;
  averageServiceMins: number;
  activeCountersCount: number;
  pausedCountersCount: number;
  emergencyRequestsCount: number;
  queueBreakdown: Array<{
    name: string;
    code: string;
    waiting: number;
    completed: number;
    avgWait: number;
  }>;
}

export interface GeneratedReport {
  timestamp: string;
  executiveSummary: string;
  congestionAnalysis: string;
  counterEfficiency: string;
  emergencyResolutionInsight: string;
  recommendations: string[];
  groundedMetrics: Record<string, any>;
}

/**
 * Gemini Operational Reporting - Grounded in actual queue KPIs
 */
export async function generateOperationalReport(metrics: OperationalMetricsInput): Promise<GeneratedReport> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== "") {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are the lead institutional operations analyst for a physical crowd and queue management system.
Analyze the following live operational metrics:
${JSON.stringify(metrics, null, 2)}

Provide a strict, grounded operational assessment report. Do not invent ungrounded facts.
Return a valid JSON object with the following schema:
{
  "executiveSummary": "Concise 2-sentence summary of queue health and throughput.",
  "congestionAnalysis": "Analysis of current waiting load, bottlenecks, and queue distribution.",
  "counterEfficiency": "Evaluation of active vs paused counter capacity and service speed.",
  "emergencyResolutionInsight": "Assessment of priority handling and emergency review volume.",
  "recommendations": ["Actionable operational recommendation 1", "Recommendation 2", "Recommendation 3"]
}
Only output the JSON object.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text() || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          timestamp: new Date().toISOString(),
          executiveSummary: parsed.executiveSummary || "System running within normal operational parameters.",
          congestionAnalysis: parsed.congestionAnalysis || "Queue load is balanced across active departments.",
          counterEfficiency: parsed.counterEfficiency || "Counter throughput matches incoming demand.",
          emergencyResolutionInsight: parsed.emergencyResolutionInsight || "All emergency requests processed.",
          recommendations: parsed.recommendations || ["Maintain current counter staffing."],
          groundedMetrics: metrics,
        };
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to grounded rule-based report:", err);
    }
  }

  // Grounded rule-based fallback report
  const waitState = metrics.waitingCount > 10 ? "Elevated congestion observed." : "Queue flow is optimal.";
  const counterState = metrics.pausedCountersCount > 0 ? `${metrics.pausedCountersCount} counter(s) currently on break.` : "All assigned counters active.";
  const noShowRatio = metrics.completedCount > 0 ? ((metrics.noShowCount / (metrics.completedCount + metrics.noShowCount)) * 100).toFixed(1) : "0";

  return {
    timestamp: new Date().toISOString(),
    executiveSummary: `Total tokens processed today: ${metrics.totalTokensToday}. Current active queue: ${metrics.waitingCount} visitors across ${metrics.activeCountersCount} active counters. ${waitState}`,
    congestionAnalysis: `Average wait time is currently ~${metrics.averageWaitMins} minutes with an average service duration of ${metrics.averageServiceMins} minutes. ${metrics.waitingCount > 5 ? "Staffing adjustment recommended during peak hours." : "No significant queue starvation detected."}`,
    counterEfficiency: `${metrics.activeCountersCount} counters actively processing tokens. ${counterState} No-show rate is measured at ${noShowRatio}%.`,
    emergencyResolutionInsight: `${metrics.emergencyRequestsCount} emergency review requests handled. Priority review transactions executed within atomic bounds.`,
    recommendations: [
      metrics.waitingCount > 8 ? "Allocate an additional counter to Student Services." : "Maintain standard counter allocation.",
      metrics.pausedCountersCount > 1 ? "Coordinate staggered breaks to prevent throughput drop." : "Break schedules are currently synchronized.",
      "Monitor visitor arrival pacing via the live Public Display.",
    ],
    groundedMetrics: metrics,
  };
}
