import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createToken } from "@/lib/queue/engine";
import { CreateTokenSchema } from "@/lib/security/validation";
import { sanitizeText } from "@/lib/security/sanitize";
import { checkTokenCreationRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get("queueId");
    const status = searchParams.get("status");

    const tokens = await prisma.token.findMany({
      where: {
        ...(queueId ? { queueId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        queue: true,
        counter: true,
        emergencyRequest: true,
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { position: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({ success: true, tokens });
  } catch (err: any) {
    console.error("Error fetching tokens:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Zod Validation
    const parsed = CreateTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { queueId, visitorName, purpose, turnstileToken, honeypot } = parsed.data;

    // 2. Honeypot Bot Check
    if (honeypot && honeypot.length > 0) {
      return NextResponse.json({ success: false, error: "Automated submission rejected" }, { status: 400 });
    }

    // 3. IP Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const rateLimit = checkTokenCreationRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Maximum 2 token creations per 15 minutes per IP.",
        },
        { status: 429 }
      );
    }

    // 4. Cloudflare Turnstile Verification
    const turnstileResult = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, error: "Bot verification failed. Please try again." },
        { status: 403 }
      );
    }

    // 5. Sanitization
    const cleanVisitorName = sanitizeText(visitorName) || "Visitor";
    const cleanPurpose = sanitizeText(purpose) || "General Service";

    // 6. Generate Unique Session ID for each ticket submission
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 7. Atomic Queue Engine Execution
    const token = await createToken({
      queueId,
      visitorSessionId: sessionId,
      visitorName: cleanVisitorName,
      purpose: cleanPurpose,
    });

    const response = NextResponse.json({ success: true, token }, { status: 201 });

    // Set signed session cookie
    response.cookies.set("lq_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: any) {
    console.error("Error creating token:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create token" },
      { status: 500 }
    );
  }
}
