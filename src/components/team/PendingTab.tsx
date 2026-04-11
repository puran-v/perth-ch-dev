"use client";

/**
 * PendingTab — lists pending invitations inside a single rounded card
 * matching the Figma "Pending invites" layout. Card header has the
 * title + Resend All button; below it sits a table-like grid of rows
 * (PendingInvitationRow components) on desktop, or stacked cards on
 * mobile (each row component renders both layouts).
 *
 * The grid template lives here in PendingTab so the column header row
 * and the data rows always agree on widths — the row component takes
 * the template as a prop. Single source of truth.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Old Author: Puran
// New Author: Puran
// Impact: rebuilt as a single rounded card with table header + grid rows
//         matching the Figma "Pending invites" layout
// Reason: client requested visual parity with the Figma — same card-shell
//         pattern as the new UsersTab so the whole feature feels cohesive

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { EmptyState } from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import {
  useInvitations,
  useResendAllInvitations,
} from "@/hooks/team/useInvitations";
import { ApiError } from "@/lib/api-client";
import { PendingInvitationRow } from "./PendingInvitationRow";

/**
 * Tailwind grid-template-columns string for the desktop layout. Defined
 * once here and passed down to every PendingInvitationRow so the data
 * row columns always line up perfectly with the header row above.
 *
 * SIX columns with proportional fr units matching the Figma layout:
 *
 *   Name | Email | Role | Sent | Expires | Actions
 *   1.5fr 1.5fr   0.85fr 0.85fr 0.85fr    1.1fr
 *
 * Each fr unit = ~15% of the available horizontal space, which gives:
 *   - Name:    22.5%   (avatar + name + optional job title)
 *   - Email:   22.5%   (long-enough address fits without truncation)
 *   - Role:    12.8%   (pill, "Member" / "Manager 2" etc.)
 *   - Sent:    12.8%   ("31 min ago" / "17 hr ago")
 *   - Expires: 12.8%   ("14th April" pill / "Active" pill)
 *   - Actions: 16.6%   (Resend + Revoke pill buttons)
 *
 * Why proportional fr instead of auto + spacer (which I tried first):
 *   - `1fr 1fr` on Name/Email makes those two columns greedy-split all
 *     leftover space, pushing Email's content visually toward the
 *     centre of the card.
 *   - `auto auto 1fr auto auto auto auto` (spacer trick) packs
 *     Name+Email tight against the left edge with a huge dead gap
 *     before Role.
 *   - Proportional fr puts each column where the Figma puts it: a
 *     normal table layout, no clusters, no centring.
 *
 * Minimum widths prevent collapse when content is very short:
 *   - Name min 140px (room for avatar + ~10 chars)
 *   - Email min 180px (room for ~22 chars)
 *   - Role/Sent/Expires min 80/70/80 (pill dimensions)
 *   - Actions min 160px (Resend + Revoke buttons + gap)
 *
 * Rendered widths on a 1280px card with px-6 padding (1184px usable
 * minus 80px gap = 1104px shared by 6.65fr) work out to:
 *   Name 249, Email 249, Role 141, Sent 141, Expires 141, Actions 183
 *   = 1104px total ✓
 */
const PENDING_GRID_COLS =
  "md:grid-cols-[minmax(140px,1.5fr)_minmax(180px,1.5fr)_minmax(80px,0.85fr)_minmax(70px,0.85fr)_minmax(80px,0.85fr)_minmax(160px,1.1fr)]";

/**
 * Renders the Pending tab body. Wraps the row list in a single card
 * with header + Resend All button on top. Mobile collapses the table
 * into a stacked card view.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function PendingTab() {
  const { data: invitations, isLoading, error, refetch } = useInvitations();
  const resendAll = useResendAllInvitations();
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Fires the bulk resend endpoint. Shows a toast with the count on
   * success so the admin knows how many recipients were queued.
   */
  const handleResendAll = async () => {
    try {
      const result = await resendAll.mutateAsync();
      if (result.count === 0) {
        toast.info("No pending invitations to resend.");
      } else {
        toast.success(
          `${result.count} invitation${result.count === 1 ? "" : "s"} being resent.`
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to resend invitations.";
      toast.error(message);
    }
  };

  // Author: Puran
  // Impact: same ORG_REQUIRED handling as UsersTab — show a friendly setup
  //         prompt instead of dumping the raw 403 message into a red card
  // Reason: a fresh signup hitting the Pending tab before completing org
  //         setup gets the same backend error; the UX should match.
  const orgRequired =
    error instanceof ApiError && error.code === "ORG_REQUIRED";

  useEffect(() => {
    if (orgRequired) {
      toast.info(
        "Finish your organization setup before managing invitations."
      );
    }
  }, [orgRequired]);

  if (isLoading) return <PendingSkeleton />;

  if (orgRequired) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">
          Set up your organization first
        </p>
        <p className="mt-1 text-sm text-amber-800">
          You need to complete the Org Setup step before you can send or
          manage invitations.
        </p>
        <Link
          href="/dashboard/org-setup"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Go to Org Setup
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">
          Couldn&apos;t load invitations
        </p>
        <p className="mt-1 text-sm text-red-700">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-sm font-medium text-[#1a2f6e] hover:underline cursor-pointer transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
        >
          Try again
        </button>
      </div>
    );
  }

  const pending = (invitations ?? []).filter(
    (i) => !i.consumedAt && !i.revokedAt
  );

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
        <EmptyState
          title="No pending invitations"
          description="Invitations you send will appear here until they're accepted."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Card header — title + Resend All. Stacks on mobile so the
          button doesn't push the title off the edge on narrow viewports. */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Pending invites
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {pending.length} invite{pending.length === 1 ? "" : "s"} waiting
            to be accepted
          </p>
        </div>
        <Button
          onClick={handleResendAll}
          loading={resendAll.isPending}
          disabled={resendAll.isPending}
          fullWidth
          className="sm:w-auto"
        >
          Resend All
        </Button>
      </div>

      {/* Desktop section wrapped in overflow-x-auto so narrow tablet
          viewports (768-900px) can scroll horizontally inside the card
          if the grid columns exceed the viewport width. The mobile card
          layout inside each row component is `flex-col` so it never
          triggers the scrollbar regardless. Mobile rows still receive
          their normal full-width stacked layout because their
          `md:hidden` styling kicks in below the breakpoint. */}
      <div className="overflow-x-auto">
        {/* Desktop column headers — hidden < md, grid template matches
            the row component's template via PENDING_GRID_COLS so the
            data row columns and header columns stay aligned.
            Title case + dark text + white background to match the
            Figma "Pending invites" table header style. The Actions
            column has no visible label (the buttons speak for
            themselves) but keeps an sr-only "Actions" string so
            screen readers still announce the column. */}
        <div
          className={`hidden md:grid ${PENDING_GRID_COLS} items-center gap-4 border-b border-slate-100 bg-white px-6 py-3 text-sm font-medium text-black`}
        >
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Sent</div>
          <div>Expires</div>
          <div className="text-right">
            <span className="sr-only">Actions</span>
          </div>
        </div>

        {/* Pending rows — each component renders both desktop grid row
            and mobile card from one instance, so per-row hooks fire
            exactly once. Border-b on each row, last:border-b-0 on the
            final row to keep the card footer clean. */}
        <div>
          {pending.map((inv) => (
            <PendingInvitationRow
              key={inv.id}
              invitation={inv}
              busy={busyId === inv.id || resendAll.isPending}
              onBusyChange={(busy) => setBusyId(busy ? inv.id : null)}
              onToast={(msg, type) => {
                if (type === "error") toast.error(msg);
                else toast.success(msg);
              }}
              gridCols={PENDING_GRID_COLS}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton matching the new card shape */
function PendingSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
      </div>
      {/* Row skeletons */}
      <div className="animate-pulse divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-9 w-9 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-100" />
            </div>
            <div className="hidden h-6 w-16 rounded-full bg-slate-100 lg:block" />
            <div className="hidden h-6 w-20 rounded-full bg-slate-100 lg:block" />
            <div className="h-9 w-32 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
