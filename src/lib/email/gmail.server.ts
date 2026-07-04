// Email sender helper (server-only) — powered by Brevo SMTP via Nodemailer.
//
// Required env vars:
//   BREVO_SMTP_USER  — your Brevo SMTP login (e.g. b073fb001@smtp-brevo.com)
//   BREVO_SMTP_PASS  — your Brevo SMTP key (xsmtpsib-...)
//   BREVO_SMTP_FROM  — verified sender address (e.g. yusufoyedele7@gmail.com)
//   PUBLIC_APP_URL   — your deployed domain (optional, defaults to localhost)

import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendGmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const recipients = opts.to.filter((e) => !!e && /.+@.+\..+/.test(e));
  if (recipients.length === 0) return { ok: false, error: "no_recipients" };

  const transporter = getTransporter();
  if (!transporter) {
    console.error("[email] BREVO_SMTP_USER or BREVO_SMTP_PASS not set");
    return { ok: false, error: "smtp_not_configured" };
  }

  const from = process.env.BREVO_SMTP_FROM ?? process.env.BREVO_SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"AATU Disciplinary Portal" <${from}>`,
      to: recipients.join(", "),
      subject: opts.subject,
      html: opts.html,
      text:
        opts.text ??
        opts.html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+\n/g, "\n")
          .trim(),
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

export function appUrl(path: string): string {
  const base = process.env.PUBLIC_APP_URL ?? "http://localhost:5173";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function emailLayout(opts: {
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaText && opts.ctaUrl
      ? `<p style="margin:28px 0;"><a href="${opts.ctaUrl}" style="background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;font-family:Arial,sans-serif;">${opts.ctaText}</a></p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
      <h1 style="font-size:20px;margin:0 0 16px;">${opts.heading}</h1>
      <div style="font-size:14px;line-height:1.55;color:#1f2937;">${opts.bodyHtml}</div>
      ${cta}
      <p style="font-size:12px;color:#6b7280;margin-top:28px;">AATU Disciplinary Portal</p>
    </div>
  </body></html>`;
}
