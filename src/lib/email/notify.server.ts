import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmail, appUrl, emailLayout } from "./gmail.server";

const PANEL_ROLES = ["committee", "dsa", "dean"] as const satisfies readonly (
  | "committee"
  | "dsa"
  | "dean"
)[];

type EmailResult = Awaited<ReturnType<typeof sendGmail>>;

function toWAT(date: Date): string {
  return date.toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
}

async function getPanelEmails(): Promise<string[]> {
  const { data: rs } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", [...PANEL_ROLES]);
  const ids = Array.from(new Set((rs ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [];
  const { data: profs } = await supabaseAdmin.from("profiles").select("email").in("id", ids);
  return Array.from(new Set((profs ?? []).map((p) => p.email).filter((e): e is string => !!e)));
}

async function getCaseContext(caseId: string) {
  const { data: c } = await supabaseAdmin
    .from("cases")
    .select(
      "id, case_number, title, description, severity, status, student_id, student_name, student_matric, reporter_id, incident_date, incident_location",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (!c) return null;
  const ids = [c.student_id, c.reporter_id].filter((v): v is string => !!v);
  const { data: profs } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  let studentEmail: string | null = c.student_id ? (byId.get(c.student_id)?.email ?? null) : null;
  let studentName: string | null = byId.get(c.student_id ?? "")?.full_name ?? c.student_name;
  if (!studentEmail && c.student_matric) {
    const { data: sp } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("matric_number", c.student_matric)
      .maybeSingle();
    if (sp) {
      studentEmail = sp.email ?? null;
      studentName = studentName ?? sp.full_name ?? null;
    }
  }
  return {
    c,
    studentEmail,
    studentName,
    reporterEmail: c.reporter_id ? (byId.get(c.reporter_id)?.email ?? null) : null,
    reporterName: byId.get(c.reporter_id ?? "")?.full_name ?? "A lecturer",
  };
}

export async function notifyCaseFiled(caseId: string) {
  const ctx = await getCaseContext(caseId);
  if (!ctx) return { ok: false, error: "case_not_found" };
  const panel = await getPanelEmails();
  if (panel.length === 0) return { ok: false, error: "no_panel_recipients" };

  const subject = `New incident filed: ${ctx.c.case_number} — ${ctx.c.title}`;
  const html = emailLayout({
    heading: "A new disciplinary incident has been filed",
    bodyHtml: `
      <p><strong>${ctx.reporterName}</strong> filed a new incident requiring review.</p>
      <table style="font-size:14px;width:100%;margin:12px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 8px;color:#6b7280;">Case</td><td style="padding:4px 8px;font-family:monospace;">${ctx.c.case_number}</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280;">Title</td><td style="padding:4px 8px;">${escapeHtml(ctx.c.title ?? "")}</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280;">Student</td><td style="padding:4px 8px;">${escapeHtml(ctx.studentName ?? "")} (${escapeHtml(ctx.c.student_matric ?? "")})</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280;">Severity</td><td style="padding:4px 8px;text-transform:capitalize;">${escapeHtml(ctx.c.severity ?? "")}</td></tr>
        ${ctx.c.incident_date ? `<tr><td style="padding:4px 8px;color:#6b7280;">Date &amp; Time</td><td style="padding:4px 8px;">${escapeHtml(ctx.c.incident_date)}</td></tr>` : ""}
        ${ctx.c.incident_location ? `<tr><td style="padding:4px 8px;color:#6b7280;">Location</td><td style="padding:4px 8px;">${escapeHtml(ctx.c.incident_location)}</td></tr>` : ""}
      </table>
      <p style="white-space:pre-wrap;color:#374151;">${escapeHtml((ctx.c.description ?? "").slice(0, 800))}${(ctx.c.description ?? "").length > 800 ? "…" : ""}</p>
    `,
    ctaText: "Open case",
    ctaUrl: appUrl(`/cases/${ctx.c.id}`),
  });
  return sendGmail({ to: panel, subject, html });
}

export async function notifyHearingScheduled(hearingId: string) {
  const { data: h } = await supabaseAdmin
    .from("hearings")
    .select("id, case_id, scheduled_at, location, notes")
    .eq("id", hearingId)
    .maybeSingle();
  if (!h) return { ok: false, error: "hearing_not_found" };
  const ctx = await getCaseContext(h.case_id);
  if (!ctx) return { ok: false, error: "case_not_found" };
  const panel = await getPanelEmails();
  const studentTo = ctx.studentEmail ? [ctx.studentEmail] : [];
  const staffTo = Array.from(
    new Set(
      [...panel, ctx.reporterEmail].filter((e): e is string => !!e && e !== ctx.studentEmail),
    ),
  );
  if (studentTo.length === 0 && staffTo.length === 0)
    return { ok: false, error: "no_recipients", studentSent: false };

  const when = h.scheduled_at ? new Date(h.scheduled_at) : null;
  const subject = `Hearing scheduled: ${ctx.c.case_number} — ${when ? toWAT(when) : "TBD"}`;
  const html = emailLayout({
    heading: "Hearing scheduled",
    bodyHtml: hearingBodyHtml(ctx, h, false),
    ctaText: "View case",
    ctaUrl: appUrl(`/cases/${ctx.c.id}`),
  });
  const studentResult: EmailResult = studentTo.length
    ? await sendGmail({ to: studentTo, subject, html })
    : { ok: false, error: "student_email_missing" };
  const staffResult: EmailResult = staffTo.length
    ? await sendGmail({ to: staffTo, subject, html })
    : { ok: true };
  const ok = studentResult.ok && staffResult.ok;
  return {
    ok,
    error: ok ? undefined : (studentResult.error ?? staffResult.error),
    id: studentResult.id ?? staffResult.id,
    studentSent: studentResult.ok,
    staffSent: staffResult.ok,
  };
}

export async function sendHearingReminders(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  const now = new Date();
  const start = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
  const end = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();
  const { data: hearings } = await supabaseAdmin
    .from("hearings")
    .select("id, case_id, scheduled_at, location, notes, reminder_sent_at")
    .gte("scheduled_at", start)
    .lte("scheduled_at", end);

  let sent = 0,
    skipped = 0,
    errors = 0;
  for (const h of hearings ?? []) {
    if ((h as { reminder_sent_at?: string | null }).reminder_sent_at) {
      skipped++;
      continue;
    }
    const ctx = await getCaseContext(h.case_id);
    if (!ctx) {
      skipped++;
      continue;
    }
    const panel = await getPanelEmails();
    const studentTo = ctx.studentEmail ? [ctx.studentEmail] : [];
    const staffTo = Array.from(
      new Set(
        [...panel, ctx.reporterEmail].filter((e): e is string => !!e && e !== ctx.studentEmail),
      ),
    );
    if (studentTo.length === 0 && staffTo.length === 0) {
      skipped++;
      continue;
    }
    const when = h.scheduled_at ? new Date(h.scheduled_at) : null;
    const subject = `Reminder: hearing tomorrow — ${ctx.c.case_number}${when ? " · " + toWAT(when) : ""}`;
    const html = emailLayout({
      heading: "Reminder — your hearing is tomorrow",
      bodyHtml: hearingBodyHtml(ctx, h, true),
      ctaText: "View case",
      ctaUrl: appUrl(`/cases/${ctx.c.id}`),
    });
    const studentResult: EmailResult = studentTo.length
      ? await sendGmail({ to: studentTo, subject, html })
      : { ok: false, error: "student_email_missing" };
    const staffResult: EmailResult = staffTo.length
      ? await sendGmail({ to: staffTo, subject, html })
      : { ok: true };
    if (studentResult.ok && staffResult.ok) {
      sent++;
      await supabaseAdmin
        .from("hearings")
        .update({ reminder_sent_at: new Date().toISOString() } as never)
        .eq("id", h.id);
    } else {
      errors++;
    }
  }
  return { sent, skipped, errors };
}

function hearingBodyHtml(
  ctx: NonNullable<Awaited<ReturnType<typeof getCaseContext>>>,
  h: { scheduled_at: string | null; location: string | null; notes: string | null },
  isReminder: boolean,
) {
  const when = h.scheduled_at ? new Date(h.scheduled_at) : null;
  return `
    <p>${isReminder ? "This is a reminder that the following hearing is scheduled for tomorrow." : "A hearing has been scheduled for the following case."}</p>
    <table style="font-size:14px;width:100%;margin:12px 0;border-collapse:collapse;">
      <tr><td style="padding:4px 8px;color:#6b7280;">Case</td><td style="padding:4px 8px;font-family:monospace;">${ctx.c.case_number}</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Title</td><td style="padding:4px 8px;">${escapeHtml(ctx.c.title ?? "")}</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Student</td><td style="padding:4px 8px;">${escapeHtml(ctx.studentName ?? "")} (${escapeHtml(ctx.c.student_matric ?? "")})</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Date &amp; Time</td><td style="padding:4px 8px;">${when ? toWAT(when) : "TBD"}</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Location</td><td style="padding:4px 8px;">${escapeHtml(h.location ?? "TBD")}</td></tr>
    </table>
    ${h.notes ? `<p style="color:#374151;white-space:pre-wrap;"><strong>Notes:</strong> ${escapeHtml(h.notes)}</p>` : ""}
  `;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}