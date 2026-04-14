import { Resend } from "resend";

// Lazy singleton — only created when sendEmail is first called at runtime,
// not at module evaluation time (which would fail during `next build` if the
// RESEND_API_KEY env var isn't present in the build environment).
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ─── sendEmail helper ─────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  const { error } = await getResend().emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
