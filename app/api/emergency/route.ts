import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  submitEmergencyRequest,
  approveEmergencyRequest,
  rejectEmergencyRequest,
  toggleDirectEmergency,
} from "@/lib/queue/engine";
import { EmergencyRequestSchema, EmergencyReviewSchema } from "@/lib/security/validation";
import { sanitizeText } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const requests = await prisma.emergencyRequest.findMany({
      include: {
        token: {
          include: {
            queue: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    });

    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    console.error("Error fetching emergency requests:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch emergency requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EmergencyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { tokenId, reason } = parsed.data;
    const cleanReason = sanitizeText(reason);

    const emergencyRequest = await submitEmergencyRequest(tokenId, cleanReason);

    return NextResponse.json({ success: true, emergencyRequest }, { status: 201 });
  } catch (err: any) {
    console.error("Error submitting emergency request:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to submit emergency request" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Direct Token Priority Override (e.g. from Tokens Directory)
    if (body.tokenId && (body.action === "DIRECT_PROMOTE" || body.action === "DIRECT_DEMOTE")) {
      const setEmergency = body.action === "DIRECT_PROMOTE";
      const cleanReviewer = sanitizeText(body.reviewer) || "Admin";
      const cleanNotes = body.notes ? sanitizeText(body.notes) : undefined;
      const updated = await toggleDirectEmergency(body.tokenId, setEmergency, cleanReviewer, cleanNotes);
      const display = updated ? updated.displayNumber : body.tokenId;
      return NextResponse.json({
        success: true,
        message: setEmergency
          ? `Token ${display} promoted to Emergency (#1 in queue).`
          : `Token ${display} demoted to Standard priority.`,
        token: updated,
      });
    }

    const parsed = EmergencyReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || "Invalid review data" },
        { status: 400 }
      );
    }

    const { requestId, action, reviewer, notes } = parsed.data;
    const cleanNotes = notes ? sanitizeText(notes) : undefined;
    const cleanReviewer = sanitizeText(reviewer) || "Admin";

    if (action === "APPROVE") {
      const result = await approveEmergencyRequest(requestId, cleanReviewer, cleanNotes);
      return NextResponse.json({
        success: true,
        message: "Priority approved. Token promoted to #1 in queue.",
        ...result,
      });
    } else {
      const result = await rejectEmergencyRequest(requestId, cleanReviewer, cleanNotes);
      return NextResponse.json({
        success: true,
        message: "Priority request rejected. Queue position unchanged.",
        ...result,
      });
    }
  } catch (err: any) {
    console.error("Error reviewing emergency request:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to review emergency request" },
      { status: 400 }
    );
  }
}
