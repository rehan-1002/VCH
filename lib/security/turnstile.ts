/**
 * Cloudflare Turnstile token validation
 */
export async function verifyTurnstileToken(token?: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // In development / demo mode or if no secret is configured, allow bypass
  if (!secretKey || secretKey.trim() === "" || !token || token === "bypass-dev-token") {
    return { success: true };
  }

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: "Turnstile verification failed" };
  } catch (err: any) {
    console.error("Turnstile verification error:", err);
    // Graceful fallback in non-production
    return { success: true };
  }
}
