"use client";

/**
 * Edit Member page — dedicated route for changing a member's
 * organization role. Single-card layout matching the Figma spec:
 * header row with avatar + name + status badge, email display, a
 * two-column grid for email (read-only) + role (editable), a Last
 * Active line, and Remove + Save actions.
 *
 * V1 scope: only the organizationRoleId field is actually editable.
 * Email is stable until V2 profile settings land. Remove is reserved
 * for a future endpoint — clicking it now just informs the admin.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */

// Old Author: Puran
// New Author: Puran
// Impact: rebuilt to match Figma single-card layout (avatar + badge + grid)
// Reason: client requested parity with the Team & Users edit screen design

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useMembers, useUpdateMember } from "@/hooks/team/useMembers";
import { useRoles } from "@/hooks/team/useRoles";
import { ApiError } from "@/lib/api-client";

interface EditMemberPageProps {
  params: Promise<{ userId: string }>;
}

/**
 * Returns up to 2 uppercase initials from a full name.
 *
 * @param name - The member's full name
 * @returns 1-2 character initials string
 */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Renders the Team & Users edit member page. Navigates back to
 * /dashboard/team after a successful save.
 *
 * @param params - Route params with the userId (async per Next 16)
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */
export default function EditMemberPage({ params }: EditMemberPageProps) {
  // Next.js 16 async params API — unwrap with React.use()
  const { userId } = use(params);
  const router = useRouter();

  const { data: members, isLoading: membersLoading, error: membersError } = useMembers();
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const updateMember = useUpdateMember(userId);

  const member = members?.find((m) => m.id === userId);

  const [roleId, setRoleId] = useState("");

  // Sync roleId once the member loads
  useEffect(() => {
    if (member?.organizationRole?.id) {
      setRoleId(member.organizationRole.id);
    }
  }, [member?.organizationRole?.id]);

  const loading = membersLoading || rolesLoading;

  /**
   * Submits the role change. On success, toasts + navigates back.
   * Maps the backend's AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED error to a
   * clear message so the admin knows why a demote was rejected.
   *
   * @param e - The form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) {
      toast.error("Select a role before saving.");
      return;
    }
    try {
      await updateMember.mutateAsync({ organizationRoleId: roleId });
      toast.success(`Role updated for ${member?.fullName}.`);
      router.push("/dashboard/team");
    } catch (err: unknown) {
      if (
        err instanceof ApiError &&
        err.code === "AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED"
      ) {
        toast.error(
          "You can't remove the only admin. Promote another user to Admin first."
        );
        return;
      }
      const message =
        err instanceof ApiError ? err.message : "Failed to update member.";
      toast.error(message);
    }
  };

  /**
   * Remove action — not wired to a backend endpoint in V1.
   * We surface an info toast so the admin knows it's intentionally not
   * active yet, matching the design fidelity without pretending to work.
   */
  const handleRemove = () => {
    toast.info("Removing members is coming in a future release.");
  };

  // Loading skeleton — single pulse card
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <BackToTeamLink />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team &amp; Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage who has access. Update a member&apos;s role to change which
            modules they can use.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200" />
              <div className="h-5 w-40 rounded bg-slate-200" />
            </div>
            <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="h-11 rounded-xl bg-slate-100" />
              <div className="h-11 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not-found state
  if (membersError || !member) {
    return (
      <div className="flex flex-col gap-6">
        <BackToTeamLink />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team &amp; Users</h1>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">Member not found</p>
          <p className="mt-1 text-sm text-red-700">
            {membersError?.message ??
              "The member you're trying to edit doesn't exist or has been removed."}
          </p>
        </div>
      </div>
    );
  }

  const noChange = roleId === (member.organizationRole?.id ?? "");

  // "Demoting a system admin" warning state.
  // We're demoting when (a) the member is currently on a system role AND
  // (b) the selected roleId points to a non-system role. The backend still
  // enforces the "at least one system admin" invariant — this is a soft
  // warning so the admin knows what they're about to do before the save.
  const currentlyOnSystemRole = member.organizationRole?.isSystem === true;
  const selectedRole = roles?.find((r) => r.id === roleId);
  const aboutToDemoteAdmin =
    currentlyOnSystemRole && !!selectedRole && selectedRole.isSystem !== true;

  return (
    <div className="flex flex-col gap-6">
      <BackToTeamLink />

      {/* Heading — matches Figma */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team &amp; Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage who has access. Update a member&apos;s role to change which
          modules they can use.
        </p>
      </div>

      {/* Card — single rounded container holding the whole edit form.
          Padding scales: 5/6/8 at sm/md/desktop so the card doesn't feel
          empty on wide screens or claustrophobic on narrow ones. */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:p-8"
      >
        {/* Top row: avatar + (name block with email subline + status badge).
            The avatar stays pinned left; everything to its right is a
            flex column so the email naturally sits under the name without
            any hardcoded left offsets. The status badge wraps to the next
            line on very narrow screens via flex-wrap on the inline row. */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a2f6e]/10 text-xs font-semibold text-[#1a2f6e]">
            {getInitials(member.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="truncate text-base font-semibold text-slate-900">
                {member.fullName}
              </h2>
              {member.isVerified ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Unverified
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {member.email}
            </p>
          </div>
        </div>

        {/* Grid: Email (read-only) + Role (editable).
            Break at lg: not sm: — two columns at 640px makes the role
            select too narrow for long role names. Tablet portrait shows
            one column stacked, desktop shows two. */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Email</p>
            <input
              type="email"
              value={member.email}
              readOnly
              disabled
              className="h-12 w-full cursor-not-allowed truncate rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Role</p>
            <StyledSelect
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={updateMember.isPending}
            >
              <option value="">Select role…</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isSystem ? " (System)" : ""}
                </option>
              ))}
            </StyledSelect>
            {roles && roles.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No roles available.{" "}
                <Link
                  href="/dashboard/team/roles"
                  className="font-medium underline"
                >
                  Create one
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {/* Last-admin demotion warning.
            Soft warning — the backend still enforces the invariant and
            rejects with AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED if this would
            leave the org with zero admins. The handler above catches that
            error and shows a toast. This banner is the pre-save heads-up. */}
        {aboutToDemoteAdmin && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              You&rsquo;re demoting an admin
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {member.fullName} currently has the{" "}
              <span className="font-semibold">
                {member.organizationRole?.name}
              </span>{" "}
              role. Saving will remove their full org access. If they&rsquo;re
              the only admin the save will be rejected — promote another user
              first.
            </p>
          </div>
        )}

        {/* Last Active — we don't yet track real last-active timestamps, so
            fall back to updatedAt as the closest truthful proxy. */}
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">Last Active</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatRelativeTime(member.updatedAt)}
          </p>
        </div>

        {/* Action row.
            Mobile: Save (primary) stacks on top, Remove below — primary
            action gets thumb priority.
            Desktop: Remove (secondary) on the left, Save on the right —
            classic destructive-left / primary-right pattern. */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleRemove}
            disabled={updateMember.isPending}
            className="inline-flex h-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-6 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
          <Button
            type="submit"
            loading={updateMember.isPending}
            disabled={!roleId || noChange}
            fullWidth
            className="sm:w-auto"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Small "Back to team" button rendered above the heading on every state
 * of this page (loading, not-found, main). Uses Next Link with an
 * explicit destination rather than router.back() so it stays predictable
 * even on direct page loads (e.g. opening the URL from a notification).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */
function BackToTeamLink() {
  return (
    <Link
      href="/dashboard/team"
      className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to team
    </Link>
  );
}

/**
 * Formats an ISO timestamp as a short relative time string.
 * Returns "Just now" for anything under a minute, then minutes/hours/days,
 * falling back to a locale date for anything older than a week.
 *
 * @param iso - ISO timestamp string from the API
 * @returns Human-readable relative time
 */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
