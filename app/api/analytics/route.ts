import { NextResponse } from "next/server";
import { calculateOperationalKPIs } from "@/lib/analytics/kpis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const kpis = await calculateOperationalKPIs();
    return NextResponse.json({ success: true, analytics: kpis });
  } catch (err: any) {
    console.error("Error generating analytics:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate analytics" },
      { status: 500 }
    );
  }
}
