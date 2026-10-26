import "server-only";

/**
 * Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-batch-emails).
 * Without RESEND_API_KEY (development) messages are logged instead of sent. Sending never throws:
 * a failed email must not break the action that triggered it.
 */
export type Email = { to: string; subject: string; text: string; html: string };

const FROM = () => process.env.EMAIL_FROM || "DoB Innovation & Learning Hub <no-reply@example.com>";
export const appUrl = (path = "") => `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;

export async function sendEmails(emails: Email[]) {
  if (emails.length === 0) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    for (const e of emails) console.info(`[email:dev] to=${e.to} subject="${e.subject}"\n${e.text}`);
    return;
  }
  // The batch endpoint takes up to 100 messages per request.
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((e) => ({ from: FROM(), to: [e.to], subject: e.subject, text: e.text, html: e.html }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) console.error(`[email] Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } catch (e) {
      console.error("[email] send failed:", e instanceof Error ? e.message : e);
    }
  }
}

export const sendEmail = (e: Email) => sendEmails([e]);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple branded message: heading, paragraph, optional button. */
export function renderEmail(opts: { name?: string; title: string; body: string; cta?: { label: string; path: string } }) {
  const url = opts.cta ? appUrl(opts.cta.path) : null;
  const hello = opts.name ? `Hi ${opts.name.split(" ")[0]},` : "Hello,";
  const text = [hello, "", opts.title, "", opts.body, ...(url ? ["", `${opts.cta!.label}: ${url}`] : []), "", "— DoB Innovation & Learning Hub"].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f4fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d0a1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e4f3">
<tr><td style="padding:28px 28px 8px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6d4ce0">DoB INNOVATION &amp; LEARNING HUB</td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;color:#4a4560">${esc(hello)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:20px;font-weight:600;line-height:1.3">${esc(opts.title)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.6;color:#4a4560">${esc(opts.body).replace(/\n/g, "<br>")}</td></tr>
${url ? `<tr><td style="padding:24px 28px 0"><a href="${esc(url)}" style="display:inline-block;background:#0d0a1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">${esc(opts.cta!.label)}</a></td></tr>` : ""}
<tr><td style="padding:28px;font-size:12px;color:#8a85a0">You’re receiving this because you have an account on the DoB Innovation &amp; Learning Hub.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
