"use client";

/**
 * InviteTab — bulk-create invitations via the add-row pattern:
 * one row per invite, explicit email + role per row.
 *
 * V1 cap: 50 invites per batch (enforced server-side too).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Old Author: Puran
// New Author: Puran
// Impact: removed the paste-chips mode + mode switch pills
// Reason: client pared the invite UX down to add-row only for V1

import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useRoles } from "@/hooks/team/useRoles";
import { useCreateInvitations } from "@/hooks/team/useInvitations";
import { ApiError } from "@/lib/api-client";
import type { BulkInviteInput } from "@/types/team";

/** RFC-compatible-enough email regex for client-side checks */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Max invites per batch (matches backend bulkInviteSchema) */
const MAX_INVITES = 50;

interface InviteTabProps {
  /** Called after a successful batch so the parent can switch to the Pending tab */
  onInviteSuccess?: () => void;
}

/** A single row in the add-row form. firstName/lastName/email/role are
 *  required to send; jobTitle and personalMessage are optional and live
 *  per row so each invitee can get their own message. id is a stable
 *  client-only key for React list rendering (not sent to the server). */
interface InviteRow {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  organizationRoleId: string;
  personalMessage: string;
}

/** Generate a lightweight unique id for rows */
const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/** Build an empty row — extracted so initial state and addRow stay in sync */
const makeEmptyRow = (): InviteRow => ({
  id: makeRowId(),
  firstName: "",
  lastName: "",
  jobTitle: "",
  email: "",
  organizationRoleId: "",
  personalMessage: "",
});

/**
 * Main InviteTab component. Add-row only — each row has its own email + role
 * and can be removed independently. Personal message applies to the whole batch.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function InviteTab({ onInviteSuccess }: InviteTabProps) {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const createInvitations = useCreateInvitations();

  const [rows, setRows] = useState<InviteRow[]>([makeEmptyRow()]);

  /**
   * Count of rows that are ready to send. A row is valid when first name,
   * last name, email, and role are all filled in. Job title is optional
   * and doesn't affect validity.
   */
  const validCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.firstName.trim().length > 0 &&
          r.lastName.trim().length > 0 &&
          EMAIL_RE.test(r.email.trim()) &&
          r.organizationRoleId
      ).length,
    [rows]
  );

  const disabled =
    rolesLoading || createInvitations.isPending || validCount === 0;

  /** Append an empty row (respects the 50-invite cap) */
  const addRow = () => {
    if (rows.length >= MAX_INVITES) {
      toast.warning(`You can invite up to ${MAX_INVITES} people at once.`);
      return;
    }
    setRows((prev) => [...prev, makeEmptyRow()]);
  };

  /** Remove a row by id (keeps at least one row in the form) */
  const removeRow = (id: string) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)
    );
  };

  /** Editable fields on a row — used by the typed updateRow helper */
  type EditableField =
    | "firstName"
    | "lastName"
    | "jobTitle"
    | "email"
    | "organizationRoleId"
    | "personalMessage";

  /** Update a specific field on a row */
  const updateRow = (id: string, field: EditableField, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  /**
   * Builds the BulkInviteInput payload and submits it.
   * Reports partial success from the `skipped` array via toasts.
   */
  const handleSubmit = async () => {
    const invites = rows
      .filter(
        (r) =>
          r.firstName.trim().length > 0 &&
          r.lastName.trim().length > 0 &&
          EMAIL_RE.test(r.email.trim()) &&
          r.organizationRoleId
      )
      .map((r) => ({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        // Send null when empty so the backend stores null instead of an
        // empty string — keeps the column semantics clean for downstream
        // queries that check for "is the field set?"
        jobTitle: r.jobTitle.trim() || null,
        email: r.email.trim(),
        organizationRoleId: r.organizationRoleId,
        personalMessage: r.personalMessage.trim() || null,
      }));

    if (invites.length === 0) {
      toast.error("Fill in name, email, and role for at least one invite.");
      return;
    }

    const payload: BulkInviteInput = { invites };

    try {
      const result = await createInvitations.mutateAsync(payload);
      const createdCount = result.created.length;
      const skippedCount = result.skipped.length;

      if (createdCount > 0) {
        toast.success(
          `${createdCount} invitation${createdCount === 1 ? "" : "s"} sent${
            skippedCount > 0 ? ` · ${skippedCount} skipped` : ""
          }.`
        );
      }

      if (skippedCount > 0) {
        const alreadyMember = result.skipped
          .filter((s) => s.reason === "ALREADY_MEMBER")
          .map((s) => s.email);
        const alreadyPending = result.skipped
          .filter((s) => s.reason === "ALREADY_PENDING")
          .map((s) => s.email);
        // Old Author: Puran
        // New Author: Puran
        // Impact: ALREADY_MEMBER is now a hard error toast, not info
        // Reason: client wanted a clear "this email is already in use"
        //         message instead of the soft "ℹ" pill that was easy to
        //         miss. ALREADY_PENDING stays as info because resending
        //         is a valid follow-up action via the Pending tab.
        if (alreadyMember.length) {
          const list = alreadyMember.slice(0, 3).join(", ");
          const more = alreadyMember.length > 3 ? "…" : "";
          toast.error(
            alreadyMember.length === 1
              ? `${list} is already a member of your organization.`
              : `These emails are already members: ${list}${more}`
          );
        }
        if (alreadyPending.length) {
          toast.info(
            `Already pending: ${alreadyPending.slice(0, 3).join(", ")}${
              alreadyPending.length > 3 ? "…" : ""
            }`
          );
        }
      }

      if (createdCount > 0) {
        // Reset to a single empty row — per-row personalMessage resets
        // along with the row state since it lives on InviteRow now.
        setRows([makeEmptyRow()]);
        onInviteSuccess?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : "Failed to send invitations.";
      toast.error(message);
    }
  };

  // No-roles guard — can't invite without a role to assign
  if (!rolesLoading && (!roles || roles.length === 0)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <p className="text-sm font-semibold text-amber-900">
          Create a role first
        </p>
        <p className="mt-1 text-sm text-amber-800">
          You need at least one role before you can invite teammates.
        </p>
        <Link
          href="/dashboard/team/roles"
          className="mt-3 inline-flex h-10 items-center rounded-full bg-[#1a2f6e] px-4 text-sm font-medium text-white transition-colors hover:bg-[#15255a]"
        >
          Go to roles
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Row list.
          Each row is a card containing an email pill, a role pill, and a
          remove button. On mobile the card stacks vertically and shows a
          "Remove" text button at the bottom right; from sm+ everything
          sits on one line with a 48×48 icon button. All three controls
          are h-12 rounded-full so they line up perfectly with each other
          and with the Input primitive. */}
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            {/* Row label so the admin can tell rows apart in a long batch */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Invite {idx + 1}
              </p>
              {/* Top-right remove icon — hidden when this is the only row
                  so the form always has at least one. */}
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={createInvitations.isPending}
                  aria-label={`Remove invite ${idx + 1}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Field grid — single column on mobile, two on sm+. The grid
                gives consistent gutters between fields without the
                alignment headaches of nesting flex rows. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel text="First name">
                <Input
                  type="text"
                  placeholder="John"
                  value={row.firstName}
                  onChange={(e) =>
                    updateRow(row.id, "firstName", e.target.value)
                  }
                  disabled={createInvitations.isPending}
                  autoComplete="off"
                />
              </FieldLabel>

              <FieldLabel text="Last name">
                <Input
                  type="text"
                  placeholder="Doe"
                  value={row.lastName}
                  onChange={(e) =>
                    updateRow(row.id, "lastName", e.target.value)
                  }
                  disabled={createInvitations.isPending}
                  autoComplete="off"
                />
              </FieldLabel>

              {/* Email spans both columns at sm+ so the input has room
                  for long addresses. */}
              <div className="sm:col-span-2">
                <FieldLabel text="Email">
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={row.email}
                    onChange={(e) =>
                      updateRow(row.id, "email", e.target.value)
                    }
                    disabled={createInvitations.isPending}
                    autoComplete="off"
                  />
                </FieldLabel>
              </div>

              <FieldLabel
                text="Job title"
                hint="optional"
              >
                <Input
                  type="text"
                  placeholder="e.g. Driver"
                  value={row.jobTitle}
                  onChange={(e) =>
                    updateRow(row.id, "jobTitle", e.target.value)
                  }
                  disabled={createInvitations.isPending}
                  autoComplete="off"
                />
              </FieldLabel>

              <FieldLabel text="Role">
                <StyledSelect
                  value={row.organizationRoleId}
                  onChange={(e) =>
                    updateRow(row.id, "organizationRoleId", e.target.value)
                  }
                  disabled={createInvitations.isPending || rolesLoading}
                  aria-label={`Role for invite ${idx + 1}`}
                >
                  <option value="">Select role…</option>
                  {roles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </StyledSelect>
              </FieldLabel>

              {/* Personal message — spans both columns at sm+ so the
                  textarea has comfortable width for a multi-line note.
                  Per-invite, optional, max 1000 chars. */}
              <div className="sm:col-span-2">
                <FieldLabel text="Personal message" hint="optional">
                  <textarea
                    value={row.personalMessage}
                    onChange={(e) =>
                      updateRow(row.id, "personalMessage", e.target.value)
                    }
                    rows={3}
                    maxLength={1000}
                    placeholder={`Add a note just for ${row.firstName.trim() || "this person"}`}
                    disabled={createInvitations.isPending}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 focus:outline-none disabled:opacity-50"
                  />
                </FieldLabel>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={
            rows.length >= MAX_INVITES || createInvitations.isPending
          }
          className="inline-flex h-10 items-center self-start rounded-full px-3 text-sm font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 disabled:opacity-50 cursor-pointer"
        >
          + Add another invite
        </button>
      </div>

      {/* Submit — at narrow widths the helper text wraps above the button
          so the primary CTA never gets squeezed off the right edge. */}
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {validCount} valid invite{validCount === 1 ? "" : "s"}
          {validCount > 0 ? ` (max ${MAX_INVITES})` : ""}
        </p>
        <Button
          onClick={handleSubmit}
          loading={createInvitations.isPending}
          disabled={disabled}
          fullWidth
          className="sm:w-auto"
        >
          Send invitations
        </Button>
      </div>
    </div>
  );
}

/**
 * Small label-over-input wrapper used by every field in the invite card.
 * Centralises the label/spacing/optional-hint pattern so the row grid
 * doesn't repeat the same `<p className="...">Label</p>` boilerplate
 * five times.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Team - Components
 */
function FieldLabel({
  text,
  hint,
  children,
}: {
  text: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        {text}
        {hint && (
          <span className="ml-1 font-normal text-slate-400">({hint})</span>
        )}
      </p>
      {children}
    </div>
  );
}
