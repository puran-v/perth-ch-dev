"use client";

/**
 * UsersTab — lists active org members with role + last login + status.
 *
 * V1 scope: display only. Clicking Edit navigates to the dedicated edit
 * page (/dashboard/team/members/[id]/edit). Revoke is reserved for a
 * future endpoint — clicking it now informs the admin via toast (same
 * pattern as the Edit Member page Remove button).
 *
 * Visual layout matches the Figma "Active users" card: section header
 * inside a rounded white card, table on md+ with avatar / name / email /
 * role pill / last active / status / action buttons, mobile cards below
 * md per PROJECT_RULES.md §8.4.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Old Author: Puran
// New Author: Puran
// Impact: rebuilt to match the Figma "Active users" card layout — adds
//         Last Active + Status columns and Edit/Revoke pill action buttons
// Reason: client requested visual parity + real last-login time instead
//         of the updatedAt fallback we were showing before

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMembers } from "@/hooks/team/useMembers";
import { ApiError } from "@/lib/api-client";
import { RevokeMemberModal } from "./RevokeMemberModal";
import type { Member } from "@/types/team";

/**
 * Renders the Users tab body. Single API call (cached via React Query),
 * desktop table + mobile cards, no extra fetches.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function UsersTab() {
  const { data: members, isLoading, error, refetch } = useMembers();
  // Member targeted for revoke. null = modal closed. We hold the whole
  // member object (not just the id) so the modal can show name + email
  // + the system-admin warning without needing its own data fetch.
  const [revokingMember, setRevokingMember] = useState<Member | null>(null);

  // Author: Puran
  // Impact: detect the "no org yet" case the backend signals via ORG_REQUIRED
  //         so we can show a friendly setup prompt instead of a raw red error
  // Reason: a fresh signup who deep-links to /dashboard/team before saving
  //         org-setup hits requireOrg → 403 ORG_REQUIRED. The previous UI
  //         dumped the JSON-ish message into a red card, which looked broken.
  const orgRequired =
    error instanceof ApiError && error.code === "ORG_REQUIRED";

  // Surface the "set up org first" hint as a toast on first render so the
  // user sees it even if they're scrolled past the empty state. Guarded on
  // orgRequired so we don't fire it for unrelated errors.
  useEffect(() => {
    if (orgRequired) {
      toast.info(
        "Finish your organization setup before inviting team members."
      );
    }
  }, [orgRequired]);

  if (isLoading) return <MembersSkeleton />;

  if (orgRequired) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">
          Set up your organization first
        </p>
        <p className="mt-1 text-sm text-amber-800">
          You need to complete the Org Setup step before you can invite or
          manage team members.
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
          Couldn&apos;t load members
        </p>
        <p className="mt-1 text-sm text-red-700">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-sm font-medium text-[#1a2f6e] hover:underline cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
        <EmptyState
          title="No members yet"
          description="Invite your first team member to get started."
        />
      </div>
    );
  }

  return (
    <>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Card header — matches the Figma "Active users" title */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Active users
          </h2>
        </div>
        <span className="hidden text-xs text-slate-400 sm:inline">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Desktop table.
          Wrapped in overflow-x-auto + min-w on the table so mid-width
          tablets (768-1100px) with long emails or role names scroll
          horizontally inside the card instead of breaking the layout. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-256">
            <thead className="bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-6 py-3">Name</th>
                <th className="whitespace-nowrap px-6 py-3">Email</th>
                <th className="whitespace-nowrap px-6 py-3">Role</th>
                <th className="whitespace-nowrap px-6 py-3">Last Active</th>
                <th className="whitespace-nowrap px-6 py-3">Status</th>
                <th className="whitespace-nowrap px-6 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} />
                      <p className="text-sm font-semibold text-slate-900">
                        {m.fullName}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {m.email}
                  </td>
                  <td className="px-6 py-4">
                    <RolePill member={m} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatRelativeTime(m.lastLoginAt)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/team/members/${m.id}/edit`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <PencilIcon />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setRevokingMember(m)}
                        className="inline-flex h-9 items-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards — one per member, same pieces stacked vertically */}
      <div className="flex flex-col divide-y divide-slate-100 md:hidden">
        {members.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <Avatar name={m.fullName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {m.fullName}
                </p>
                <p className="truncate text-xs text-slate-500">{m.email}</p>
              </div>
              <StatusPill />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Role:</span>
                <RolePill member={m} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Last active:</span>
                <span className="text-slate-700">
                  {formatRelativeTime(m.lastLoginAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <Link
                href={`/dashboard/team/members/${m.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <PencilIcon />
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setRevokingMember(m)}
                className="inline-flex h-9 items-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Revoke confirmation — destructive action, never single-click. */}
    <RevokeMemberModal
      open={revokingMember !== null}
      onClose={() => setRevokingMember(null)}
      member={revokingMember}
    />
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

/** Round avatar showing up to 2 uppercase initials from the user's name */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a2f6e]/10 text-xs font-semibold text-[#1a2f6e]">
      {initials}
    </div>
  );
}

/**
 * Role pill — shows the user's organization role name (e.g. "Floor
 * Manager" or "Admin") rather than the system-level enum. Falls back to
 * the system role for legacy users without an org role. Uses violet to
 * match the Figma "Dispatched" pill.
 *
 * shrink-0 + max-w + truncate so a long role name like "Senior Operations
 * Coordinator" stays inside the pill shape with an ellipsis instead of
 * stretching the row. Title attribute exposes the full label on hover.
 */
function RolePill({ member }: { member: Member }) {
  const label = member.organizationRole?.name ?? member.role;
  return (
    <span
      title={label}
      className="inline-flex max-w-[140px] shrink-0 items-center truncate rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
    >
      {label}
    </span>
  );
}

/**
 * Status pill — V1 always shows "Active" green per spec.
 * shrink-0 so it never gets squeezed when sitting next to long names
 * or emails inside a flex row on mobile.
 * Once we wire real account states (suspended, locked, invited-pending)
 * this becomes a switch on member.status or similar.
 */
function StatusPill() {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      Active
    </span>
  );
}

/** Inline pencil icon used inside the Edit pill — Heroicons style */
function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 13.5V18a2.25 2.25 0 01-2.25 2.25h-12A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h4.5"
      />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Formats an ISO timestamp as a short relative time string.
 * Returns "Just Now" for anything under a minute, then minutes/hours/days,
 * falling back to a locale date for anything older than a week. Returns
 * "Never" when the timestamp is null (user hasn't logged in yet).
 *
 * Mirrors the helper on the Edit Member page so both screens use the
 * same wording. If we add more uses of this we should extract it into
 * src/lib/utils/relative-time.ts.
 *
 * @param iso - ISO timestamp string from the API, or null
 * @returns Human-readable relative time
 */
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
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

// ── Loading skeleton ────────────────────────────────────────────────

/** Skeleton placeholder while members load — matches the card shape */
function MembersSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 sm:block" />
      </div>
      <div className="animate-pulse divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-9 w-9 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-100" />
            </div>
            <div className="hidden h-6 w-20 rounded-full bg-slate-100 lg:block" />
            <div className="hidden h-6 w-16 rounded-full bg-slate-100 lg:block" />
            <div className="h-9 w-32 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
