"use client";

/**
 * PendingInvitationRow — one row inside PendingTab.
 *
 * Renders BOTH a desktop table-row layout (hidden < md) and a mobile
 * card layout (hidden >= md) from the same component instance, so the
 * per-row React Query hooks (useResendInvitation, useRevokeInvitation)
 * only fire once per invitation regardless of which layout is visible.
 *
 * The row is a styled <div> rather than a real <tr> because we want to
 * mix it with mobile card markup in a single component, and you can't
 * legally nest <tr> next to <div> in HTML. We use a CSS grid template
 * on desktop that mirrors the column layout of the parent's header row.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Old Author: Puran
// New Author: Puran
// Impact: rebuilt to match the Figma "Pending invites" table layout —
//         desktop table-row via CSS grid + mobile card layout from one
//         component instance, removed Remove expiry button (Resend
//         already extends the expiry so it's the only escape hatch we
//         need for V1)
// Reason: client wants a clean tabular view with avatar + name + email +
//         role + sent + expires + actions, matching the new UsersTab
//         visual language

import { useEffect } from "react";
import {
  useResendInvitation,
  useRevokeInvitation,
} from "@/hooks/team/useInvitations";
import { ApiError } from "@/lib/api-client";
import type { Invitation } from "@/types/team";

/** Far-future sentinel year threshold — anything past 2090 is "never" */
const NO_EXPIRY_YEAR = 2090;

interface PendingInvitationRowProps {
  invitation: Invitation;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
  /**
   * Tailwind grid-template-columns string for the desktop layout. Must
   * match the parent's header row exactly so columns line up. Passed in
   * rather than hardcoded so PendingTab is the single source of truth.
   */
  gridCols: string;
}

/**
 * Renders one pending invitation. Same component renders both the
 * desktop grid row and the mobile card — visibility is CSS-driven.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function PendingInvitationRow({
  invitation,
  busy,
  onBusyChange,
  onToast,
  gridCols,
}: PendingInvitationRowProps) {
  const resend = useResendInvitation(invitation.id);
  const revoke = useRevokeInvitation(invitation.id);

  const anyPending = resend.isPending || revoke.isPending;

  // Sync local busy state up to the parent so the row blocks interaction
  useEffect(() => {
    onBusyChange(anyPending);
    // Only re-report when the pending flag flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyPending]);

  const expiresAt = new Date(invitation.expiresAt);
  const isNeverExpire = expiresAt.getUTCFullYear() >= NO_EXPIRY_YEAR;
  const isExpired = !isNeverExpire && expiresAt.getTime() < Date.now();

  /** Display name — falls back to email username for legacy invites */
  const displayName =
    [invitation.firstName, invitation.lastName]
      .filter((p) => p && p.trim().length > 0)
      .join(" ") || invitation.email.split("@")[0];

  /** Initials — used in the avatar circle */
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  /** Executes a mutation and reports the outcome via onToast */
  const runAction = async (action: "resend" | "revoke"): Promise<void> => {
    try {
      if (action === "resend") {
        await resend.mutateAsync();
        onToast(`Invitation resent to ${invitation.email}.`, "success");
      } else {
        await revoke.mutateAsync();
        onToast(`Invitation to ${invitation.email} revoked.`, "success");
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Action failed. Please try again.";
      onToast(message, "error");
    }
  };

  // Shared pill button class — h-9 across both actions so they line up
  // Author: samir
  // Impact: added cursor-pointer + focus-visible to the shared class so every desktop + mobile pill button picks them up at once
  // Reason: all four call sites (resend/revoke × desktop/mobile) reuse this constant — fixing it here keeps the four buttons in sync without four separate edits
  const pillBtn =
    "inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40";

  const busyClass = busy ? "pointer-events-none opacity-60" : "";

  return (
    <>
      {/* ── Desktop row (md+) ── grid template matches the parent header.
          Six cells with proportional fr widths: Name, Email, Role, Sent,
          Expires, Actions. See PENDING_GRID_COLS doc in PendingTab for
          the full template breakdown and computed column widths. */}
      <div
        className={`hidden md:grid items-center gap-4 border-b border-slate-100 px-6 py-4 last:border-b-0 ${gridCols} ${busyClass}`}
      >
        {/* Name */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials} />
          <div className="min-w-0">
            <p className="truncate text-sm font-normal text-slate-600">
              {displayName}
            </p>
            {invitation.jobTitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {invitation.jobTitle}
              </p>
            )}
          </div>
        </div>

        {/* Email — min-w-0 lets truncate work inside the proportional
            column, otherwise the column would grow to fit the longest
            email instead of capping at the parent's available width. */}
        <div className="min-w-0 truncate text-sm text-slate-600">
          {invitation.email}
        </div>

        {/* Role */}
        <div>
          <RolePill name={invitation.organizationRole.name} />
        </div>

        {/* Sent */}
        <div className="text-sm text-slate-600">
          {formatRelativeTime(invitation.sentAt)}
        </div>

        {/* Expires */}
        <div>
          <ExpiryPill
            expiresAt={expiresAt}
            isNeverExpire={isNeverExpire}
            isExpired={isExpired}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => runAction("resend")}
            disabled={anyPending}
            className={`${pillBtn} border-slate-200 text-slate-700 hover:bg-slate-50`}
          >
            {resend.isPending ? "Resending…" : "Resend"}
          </button>
          <button
            type="button"
            onClick={() => runAction("revoke")}
            disabled={anyPending}
            className={`${pillBtn} border-red-200 text-red-700 hover:bg-red-50`}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </button>
        </div>
      </div>

      {/* ── Mobile card (< md) ── stacked layout */}
      <div
        className={`flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 md:hidden ${busyClass}`}
      >
        <div className="flex items-start gap-3">
          <Avatar initials={initials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-normal text-slate-600">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {invitation.email}
            </p>
          </div>
          <ExpiryPill
            expiresAt={expiresAt}
            isNeverExpire={isNeverExpire}
            isExpired={isExpired}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <RolePill name={invitation.organizationRole.name} />
          <span>Sent {formatRelativeTime(invitation.sentAt)}</span>
          {invitation.jobTitle && <span>· {invitation.jobTitle}</span>}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => runAction("resend")}
            disabled={anyPending}
            className={`${pillBtn} border-slate-200 text-slate-700 hover:bg-slate-50`}
          >
            {resend.isPending ? "Resending…" : "Resend"}
          </button>
          <button
            type="button"
            onClick={() => runAction("revoke")}
            disabled={anyPending}
            className={`${pillBtn} border-red-200 text-red-700 hover:bg-red-50`}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

/** Round avatar with up to 2 initials in brand-tinted circle */
function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a2f6e]/10 text-xs font-semibold text-[#1a2f6e]">
      {initials || "?"}
    </div>
  );
}

/** Role pill — violet to match the Figma role badges (UsersTab uses the same) */
function RolePill({ name }: { name: string }) {
  // shrink-0 + max-w-[140px] + truncate so the pill never gets crushed
  // by long names/emails inside its parent flex container, and a long
  // role name like "Senior Operations Coordinator" stays inside the pill
  // shape with an ellipsis instead of stretching the row.
  return (
    <span
      title={name}
      className="inline-flex max-w-[140px] shrink-0 items-center truncate rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
    >
      {name}
    </span>
  );
}

/**
 * Expiry pill — three states:
 *   - never expires (sentinel year >= 2090) → green "Active" pill
 *   - already expired → red "Expired" pill with the date
 *   - normal future expiry → green pill with formatted date
 *
 * Date format mirrors the Figma "27th April" — short, friendly, no year
 * unless the date is more than ~1 year out (rare for invites with 7-day
 * default expiry, but the formatter handles it).
 */
function ExpiryPill({
  expiresAt,
  isNeverExpire,
  isExpired,
}: {
  expiresAt: Date;
  isNeverExpire: boolean;
  isExpired: boolean;
}) {
  // shrink-0 + whitespace-nowrap so the pill keeps its shape even when
  // it's the third element in a tight mobile flex row next to a long
  // name and email. Without these, a long name would squeeze the pill
  // and the date text would wrap onto a second line inside the pill.
  const base =
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium";
  if (isNeverExpire) {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
        Active
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
        Expired {formatExpiryDate(expiresAt)}
      </span>
    );
  }
  return (
    <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
      {formatExpiryDate(expiresAt)}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Formats an ISO timestamp as a short relative time string.
 * "Just Now" / "N min ago" / "N hr ago" / "N days ago" / locale date.
 * Mirrors the helper on UsersTab + EditMemberPage. Should be lifted to
 * src/lib/utils/relative-time.ts once a third caller appears.
 */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "Just Now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Formats a date as "27th April" (Figma style). Adds the year only when
 * the date is more than ~365 days from now (rare with the 7-day default
 * but handles edge cases like remove-expiry-then-set-back-to-near-future).
 */
function formatExpiryDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleDateString("en-AU", { month: "long" });
  const suffix = ordinalSuffix(day);
  const moreThanYear = Math.abs(date.getTime() - Date.now()) > 365 * 24 * 60 * 60 * 1000;
  return moreThanYear
    ? `${day}${suffix} ${month} ${date.getFullYear()}`
    : `${day}${suffix} ${month}`;
}

/** Returns "st" / "nd" / "rd" / "th" for a day-of-month integer */
function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
