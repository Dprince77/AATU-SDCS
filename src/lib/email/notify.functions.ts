import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const notifyCaseFiledFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { notifyCaseFiled } = await import("./notify.server");
    return notifyCaseFiled(data.caseId);
  });

export const notifyHearingScheduledFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { hearingId: string }) => input)
  .handler(async ({ data }) => {
    const { notifyHearingScheduled } = await import("./notify.server");
    return notifyHearingScheduled(data.hearingId);
  });

const SUPPORT_EMAIL = "yusufoyedele7@gmail.com";

export const sendSupportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      subject: string;
      category: string;
      message: string;
      senderName: string;
      senderEmail: string;
      senderId: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { sendGmail, emailLayout } = await import("./gmail.server");

    const subject = data.subject.trim();
    const message = data.message.trim();
    if (!subject || !message) {
      return { ok: false, error: "missing_fields" as const };
    }

    const bodyHtml = `
      <p><strong>From:</strong> ${escapeHtml(data.senderName || "Unknown")} (${escapeHtml(data.senderEmail || "no email on file")})</p>
      <p><strong>ID:</strong> ${escapeHtml(data.senderId || "—")}</p>
      <p><strong>Category:</strong> ${escapeHtml(data.category)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    `;

    const result = await sendGmail({
      to: [SUPPORT_EMAIL],
      subject: `[AATU SDC Support] ${subject}`,
      html: emailLayout({
        heading: `Support request: ${data.category}`,
        bodyHtml,
      }),
    });

    return { ok: result.ok, error: result.error };
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
