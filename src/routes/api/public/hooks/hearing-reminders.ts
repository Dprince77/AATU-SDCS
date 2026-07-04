import { createFileRoute } from "@tanstack/react-router";

// Called by pg_cron or an external scheduler daily.
// Sends 1-day-before reminders for any hearing in the next ~24h that hasn't
// already been reminded.
//
// Protected by a shared secret: callers must pass the CRON_SECRET env var
// as the Authorization header: "Bearer <CRON_SECRET>".
// Set CRON_SECRET in your deployment environment and in your cron job config.

function checkCronSecret(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // If not configured, allow (dev fallback)
  const auth = request.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const Route = createFileRoute("/api/public/hooks/hearing-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = checkCronSecret(request);
        if (denied) return denied;
        const { sendHearingReminders } = await import("@/lib/email/notify.server");
        const result = await sendHearingReminders();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        const denied = checkCronSecret(request);
        if (denied) return denied;
        const { sendHearingReminders } = await import("@/lib/email/notify.server");
        const result = await sendHearingReminders();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});