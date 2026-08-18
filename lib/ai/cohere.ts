import { prisma } from "../db/prisma";

export interface RoutingSuggestion {
  queueId: string;
  queueName: string;
  queueCode: string;
  confidence: number;
  reasoning: string;
}

/**
 * Cohere-powered visitor intent & service triage
 * Bounded with automatic heuristic fallback
 */
export async function triageVisitorIntent(userPrompt: string): Promise<RoutingSuggestion[]> {
  const queues = await prisma.queue.findMany({
    where: { status: "ACTIVE" },
  });

  if (queues.length === 0) return [];

  const apiKey = process.env.COHERE_API_KEY;

  if (apiKey && apiKey.trim() !== "") {
    try {
      const prompt = `You are an institutional triage routing system.
Available Queues:
${queues.map((q) => `- Code "${q.code}", ID "${q.id}", Name: "${q.name}", Dept: "${q.department}", Desc: "${q.description}"`).join("\n")}

Visitor Request: "${userPrompt}"

Output JSON array of top matches sorted by confidence (0.0 to 1.0):
[
  { "queueId": "<matching-id>", "confidence": 0.95, "reasoning": "<short sentence>" }
]
Only return valid JSON array.`;

      const response = await fetch("https://api.cohere.com/v1/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const text = json.text || json.message?.content?.[0]?.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.map((item: any) => {
            const matchedQueue = queues.find((q) => q.id === item.queueId);
            return {
              queueId: item.queueId,
              queueName: matchedQueue?.name || "Service Queue",
              queueCode: matchedQueue?.code || "A",
              confidence: item.confidence || 0.8,
              reasoning: item.reasoning || "Matched intent",
            };
          });
        }
      }
    } catch (err) {
      console.warn("Cohere API call failed, using heuristic fallback:", err);
    }
  }

  // Bounded heuristic fallback
  const lower = userPrompt.toLowerCase();
  const scored = queues.map((q) => {
    let score = 0.5;
    const combined = `${q.name} ${q.department} ${q.description || ""}`.toLowerCase();

    const keywords = lower.split(/\s+/).filter((w) => w.length > 2);
    for (const kw of keywords) {
      if (combined.includes(kw)) score += 0.15;
    }

    if (lower.includes("transcript") || lower.includes("id card") || lower.includes("counseling")) {
      if (q.code === "B") score += 0.3;
    }
    if (lower.includes("fee") || lower.includes("payment") || lower.includes("scholarship") || lower.includes("money")) {
      if (q.code === "C") score += 0.3;
    }
    if (lower.includes("admission") || lower.includes("enroll") || lower.includes("register")) {
      if (q.code === "A") score += 0.3;
    }

    return {
      queueId: q.id,
      queueName: q.name,
      queueCode: q.code,
      confidence: Math.min(0.98, score),
      reasoning: `Intent matched with ${q.department} department guidelines.`,
    };
  });

  return scored.sort((a, b) => b.confidence - a.confidence);
}
