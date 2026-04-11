import nodemailer from "nodemailer";
import {
  wrapEmailTemplate,
  emailButton,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./emailTemplate";
import { NO_EXPIRY_SENTINEL } from "@/server/lib/team/invitationToken";
import { logger } from "@/server/lib/logger";

// Author: Puran
// Impact: transactional email for team invitations — brand layout + accept CTA
// Reason: wiring invitation create/resend to actually mail the recipient

/**
 * Nodemailer transporter configured from SMTP environment variables.
 * Same config as other auth emails so they share the same connection pool
 * characteristics when the server stays warm.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations Email
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Arguments for sendInvitationEmail — all the context the template needs */
export interface SendInvitationEmailArgs {
  toEmail: string;
  orgName: string;
  roleName: string;
  acceptUrl: string;
  /** Optional first name — drives the "Hi {firstName}," greeting line */
  recipientFirstName?: string | null;
  /** Optional job title — surfaced next to the role in the body copy */
  jobTitle?: string | null;
  inviterName?: string | null;
  personalMessage?: string | null;
  expiresAt: Date;
}

/**
 * Escapes user-provided strings before interpolating into the HTML body.
 * Prevents HTML injection via the personal message, org name, inviter name,
 * or role name — all of which are user-controlled on the inviter side.
 *
 * @param value - Raw string to escape
 * @returns HTML-safe string
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations Email
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends an invitation email with the branded template, a role summary,
 * optional personal message, and a single accept CTA that links to the
 * client's /accept-invitation page with the raw token in the query string.
 *
 * Matches the pattern used by sendPasswordResetEmail — throws on failure so
 * the caller can log it or roll the token back if needed.
 *
 * @param args - See SendInvitationEmailArgs
 * @throws If the SMTP transporter rejects the message
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations Email
 */
export async function sendInvitationEmail(args: SendInvitationEmailArgs): Promise<void> {
  const {
    toEmail,
    orgName,
    roleName,
    acceptUrl,
    recipientFirstName,
    jobTitle,
    inviterName,
    personalMessage,
    expiresAt,
  } = args;

  const safeOrg = escapeHtml(orgName);
  const safeRole = escapeHtml(roleName);
  const safeInviter = inviterName ? escapeHtml(inviterName) : null;
  const safeMessage = personalMessage ? escapeHtml(personalMessage) : null;
  const safeFirstName = recipientFirstName
    ? escapeHtml(recipientFirstName)
    : null;
  const safeJobTitle = jobTitle ? escapeHtml(jobTitle) : null;

  // Detect the "no expiry" sentinel so we show friendly copy instead of 2099
  const isNoExpiry = expiresAt.getTime() >= NO_EXPIRY_SENTINEL.getTime() - 1000;

  const expiryLine = isNoExpiry
    ? `This invitation does not expire.`
    : `This invitation expires on <strong style="color:${TEXT_PRIMARY};">${expiresAt.toLocaleDateString(
        "en-AU",
        { day: "numeric", month: "long", year: "numeric" }
      )}</strong>.`;

  const subject = `You're invited to join ${orgName} — The Fun Depot`;

  // Plaintext fallback — keep parity with the HTML body so screen-reader
  // and text-only mail clients see the same greeting + role context
  const greetPlain = recipientFirstName ? `Hi ${recipientFirstName},\n\n` : "";
  const inviterPlain = inviterName ? ` by ${inviterName}` : "";
  const rolePlain = jobTitle ? `${jobTitle} (${roleName})` : roleName;
  const messagePlain = personalMessage ? `\n\nPersonal message:\n${personalMessage}\n` : "";
  const expiryPlain = isNoExpiry
    ? "This invitation does not expire."
    : `This invitation expires on ${expiresAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`;

  const text = `${greetPlain}You've been invited${inviterPlain} to join ${orgName} on The Fun Depot as ${rolePlain}.
${messagePlain}
Accept your invitation and set up your account here:
${acceptUrl}

${expiryPlain}

If you weren't expecting this email you can safely ignore it.`;

  // HTML body — wrapped by the shared branded template
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">
      ${safeFirstName ? `Hi ${safeFirstName},` : `You&rsquo;re invited to join ${safeOrg}`}
    </h2>
    <p style="margin:0 0 12px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.6;">
      ${safeInviter ? `<strong style="color:${TEXT_PRIMARY};">${safeInviter}</strong> has invited you` : `You&rsquo;ve been invited`}
      to join <strong style="color:${TEXT_PRIMARY};">${safeOrg}</strong> on The Fun Depot
      as ${safeJobTitle ? `<strong style="color:${TEXT_PRIMARY};">${safeJobTitle}</strong> &mdash; ` : ``}<strong style="color:${TEXT_PRIMARY};">${safeRole}</strong>.
    </p>

    ${
      safeMessage
        ? `<div style="margin:0 0 20px;padding:16px 20px;background-color:#f8fafc;border-left:3px solid #1a2f6e;border-radius:4px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${TEXT_SECONDARY};text-transform:uppercase;letter-spacing:0.5px;">
              Personal message
            </p>
            <p style="margin:0;font-size:14px;color:${TEXT_PRIMARY};line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
          </div>`
        : ""
    }

    ${emailButton("Accept invitation", acceptUrl)}

    <p style="margin:0 0 4px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      ${expiryLine}
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you weren&rsquo;t expecting this email, you can safely ignore it.
    </p>

    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">
      If the button doesn&rsquo;t work, copy and paste this link:<br />
      <a href="${acceptUrl}" style="color:#1a2f6e;text-decoration:underline;">${acceptUrl}</a>
    </p>
  `;

  const html = wrapEmailTemplate(body);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject,
    text,
    html,
  });
}

// ── Batch sender ─────────────────────────────────────────────────────

/**
 * Default per-send delay in ms. Mailtrap sandbox (free plan) rejects more
 * than ~1 email per second with `550 5.7.0 Too many emails per second`.
 * 1200ms gives a bit of headroom above that limit while still being fast
 * enough for V1 batches (50 invites = 60s in the worst case). Override
 * via EMAIL_SEND_DELAY_MS env var — production SMTP hosts with higher
 * caps can set it to 0.
 */
const DEFAULT_SEND_DELAY_MS = 1200;

/** Max times we retry a single send when the provider rate-limits us. */
const RATE_LIMIT_RETRIES = 1;

/** Extra wait before a retry, on top of the base delay. */
const RATE_LIMIT_RETRY_DELAY_MS = 1500;

/** Sleep helper. No deps, no setTimeout-in-promise boilerplate at call sites. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the per-send delay read from EMAIL_SEND_DELAY_MS.
 * Accepts "0" to disable throttling entirely. Invalid values fall back to
 * the default so a typo in .env can't silently break rate-limit compliance.
 */
function getSendDelayMs(): number {
  const raw = process.env.EMAIL_SEND_DELAY_MS;
  if (raw === undefined || raw === "") return DEFAULT_SEND_DELAY_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SEND_DELAY_MS;
  return Math.floor(parsed);
}

/**
 * Heuristic: does this error look like a provider-side rate limit?
 * We check both the SMTP response code (550 / 421 / 429) and the message
 * body for known keywords. Used to decide whether to retry a send.
 */
function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("too many emails")) return true;
  if (msg.includes("rate limit")) return true;
  if (msg.includes("throttl")) return true;
  // Nodemailer surfaces SMTP response codes as strings in the error object
  const maybeCode = (err as { responseCode?: unknown }).responseCode;
  if (maybeCode === 421 || maybeCode === 429 || maybeCode === 550) return true;
  return false;
}

/** Shape of a single entry in a batch — everything needed to send one email */
export interface InvitationBatchEntry extends SendInvitationEmailArgs {
  /** Stable identifier used in log messages — typically the Invitation.id */
  invitationId: string;
}

/** Structured context the batch sender echoes into each log line */
export interface InvitationBatchLogContext {
  route: string;
  requestId: string;
  [key: string]: unknown;
}

/** Result shape returned after the batch finishes */
export interface InvitationBatchResult {
  sent: number;
  failed: number;
  total: number;
}

/**
 * Sends a batch of invitation emails SEQUENTIALLY with a configurable
 * throttle between sends. Handles per-entry rate-limit retries so that
 * one transient 550 from a sandbox SMTP host doesn't silently lose the
 * remaining invites in the batch.
 *
 * Designed to be called from a detached background IIFE in the API
 * route — the caller returns HTTP 201 immediately and this function
 * takes however long it needs to churn through the list. Individual
 * failures are logged, not thrown, so one bad recipient can't take
 * down the whole batch.
 *
 * @param entries - One entry per email to send
 * @param logCtx - Route + requestId for consistent logging across entries
 * @returns { sent, failed, total } counts once the batch is done
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations Email
 */
export async function sendInvitationEmailBatch(
  entries: InvitationBatchEntry[],
  logCtx: InvitationBatchLogContext
): Promise<InvitationBatchResult> {
  const delayMs = getSendDelayMs();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { invitationId, ...args } = entry;
    const perEntryCtx = {
      ...logCtx,
      invitationId,
      email: args.toEmail,
      index: i + 1,
      total: entries.length,
    };

    // Apply the throttle between sends — NOT before the first one.
    // This keeps the first invite instant and only pays the delay cost
    // on 2nd and subsequent entries in the batch.
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    let attempt = 0;
    let delivered = false;
    while (attempt <= RATE_LIMIT_RETRIES && !delivered) {
      try {
        await sendInvitationEmail(args);
        delivered = true;
        sent++;
        logger.info("Invitation email sent", perEntryCtx);
      } catch (err) {
        attempt++;
        const canRetry = attempt <= RATE_LIMIT_RETRIES && isRateLimitError(err);
        if (canRetry) {
          logger.warn(
            "Invitation email rate-limited, retrying after delay",
            { ...perEntryCtx, attempt }
          );
          await sleep(RATE_LIMIT_RETRY_DELAY_MS);
          continue;
        }
        failed++;
        logger.error("Invitation email failed", perEntryCtx, err);
        break;
      }
    }
  }

  logger.info("Invitation email batch complete", {
    ...logCtx,
    sent,
    failed,
    total: entries.length,
  });

  return { sent, failed, total: entries.length };
}
