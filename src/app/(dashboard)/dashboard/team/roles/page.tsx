"use client";

/**
 * Roles page — lists, creates, edits, and deletes OrganizationRoles.
 *
 * V1 scope: no drag-to-reorder UI, no bulk actions. Edit and delete
 * are modal-based; create uses the same RoleFormModal in "create" mode.
 * Follows PROJECT_RULES.md §8.5 (loading skeleton + empty + error states)
 * and §8.4 (mobile card view below md breakpoint).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */

// Author: Puran
// Impact: new dashboard page for OrganizationRole CRUD
// Reason: roles must exist before invites can reference them

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRoles } from "@/hooks/team/useRoles";
import { RoleFormModal } from "@/components/team/RoleFormModal";
import { DeleteRoleModal } from "@/components/team/DeleteRoleModal";
import { ApiError } from "@/lib/api-client";
import type { OrganizationRole } from "@/types/team";

/** Module flag → short badge label, used in the list row */
const MODULE_LABELS = [
  { key: "moduleA", label: "A" },
  { key: "moduleB", label: "B" },
  { key: "moduleC", label: "C" },
  { key: "moduleD", label: "D" },
  { key: "moduleE", label: "E" },
] as const;

/**
 * Renders the /dashboard/team/roles route.
 * Manages modal state locally — React Query handles the list refresh.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */
export default function RolesPage() {
  const { data: roles, isLoading, error, refetch } = useRoles();
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<OrganizationRole | null>(null);

  // Author: Puran
  // Impact: same ORG_REQUIRED handling pattern used by UsersTab + PendingTab
  // Reason: a fresh signup who deep-links to /dashboard/team/roles before
  //         saving org-setup hits requireOrg → 403 ORG_REQUIRED. Render a
  //         friendly setup prompt + toast instead of dumping the raw 403
  //         message into a red error card.
  const orgRequired =
    error instanceof ApiError && error.code === "ORG_REQUIRED";

  useEffect(() => {
    if (orgRequired) {
      toast.info("Finish your organization setup before creating roles.");
    }
  }, [orgRequired]);

  /** Opens the form modal in create mode */
  const handleCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  /**
   * Opens the form modal in edit mode for a specific role.
   * Defensive no-op for system roles — the UI hides these buttons, but
   * this guard prevents a keyboard shortcut / stale DOM reference from
   * opening a form that the backend would reject with SYSTEM_ROLE_LOCKED.
   */
  const handleEdit = (role: OrganizationRole) => {
    if (role.isSystem) return;
    setEditingRole(role);
    setFormOpen(true);
  };

  /** Closes the form modal and clears edit context */
  const handleFormClose = () => {
    setFormOpen(false);
    setEditingRole(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Define what each group of users can access in your organization.
          </p>
        </div>
        <Button onClick={handleCreate}>+ Create role</Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <RolesSkeleton />
      ) : orgRequired ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">
            Set up your organization first
          </p>
          <p className="mt-1 text-sm text-amber-800">
            You need to complete the Org Setup step before you can create or
            manage roles.
          </p>
          <Link
            href="/dashboard/org-setup"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Go to Org Setup
          </Link>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load roles
          </p>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !roles || roles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
          <EmptyState
            title="No roles yet"
            description="Create your first role to start assigning module access to your team."
            action={<Button onClick={handleCreate}>+ Create role</Button>}
          />
        </div>
      ) : (
        <>
          {/* Desktop table — horizontally scrollable inside its rounded
              card so narrow tablet widths (768-900px) with long role
              names don't break the layout. The outer card owns the
              border/radius; the inner div owns the horizontal scroll so
              the rounded corners clip the scrollable content cleanly. */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-3">Name</th>
                    <th className="whitespace-nowrap px-6 py-3">Modules</th>
                    <th className="w-32 whitespace-nowrap px-6 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {role.name}
                          </p>
                          {role.isSystem && <SystemRoleBadge />}
                        </div>
                        {role.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {role.description}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ModuleBadges role={role} />
                      </td>
                      <td className="px-6 py-4">
                        {/* System roles are locked — no edit/delete buttons.
                            Backend enforces this via SYSTEM_ROLE_LOCKED; UI
                            just hides the affordances so there's nothing to
                            click. */}
                        {role.isSystem ? (
                          <p className="text-right text-xs text-slate-400">
                            Locked
                          </p>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(role)}
                              className="text-xs font-medium text-[#1a2f6e] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              onClick={() => setDeletingRole(role)}
                              className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view — per PROJECT_RULES.md §8.4 */}
          <div className="flex flex-col gap-3 md:hidden">
            {roles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {role.name}
                      </p>
                      {role.isSystem && <SystemRoleBadge />}
                    </div>
                    {role.description && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {role.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <ModuleBadges role={role} />
                </div>
                {/* Mobile actions row — hidden entirely for system roles
                    since there's nothing actionable left. Uses pill
                    buttons instead of text links so mobile tap targets
                    are ≥ 36px rather than the ~16px of underlined text. */}
                {!role.isSystem && (
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(role)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRole(role)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-red-200 px-4 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <RoleFormModal
        open={formOpen}
        onClose={handleFormClose}
        initialRole={editingRole}
      />
      <DeleteRoleModal
        open={deletingRole !== null}
        onClose={() => setDeletingRole(null)}
        role={deletingRole}
      />
    </div>
  );
}

/**
 * Renders a compact row of module-access badges (A-E).
 * Enabled modules show in brand color; disabled are muted.
 */
/**
 * Small "System" pill shown next to platform-seeded role names so admins
 * can tell at a glance that the row is locked. Tooltip explains why.
 */
function SystemRoleBadge() {
  return (
    <span
      title="System role — locked from editing"
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
    >
      {/* Heroicons-style padlock. 24×24 viewBox, no transform hacks. */}
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
      System
    </span>
  );
}

function ModuleBadges({ role }: { role: OrganizationRole }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MODULE_LABELS.map(({ key, label }) => {
        const enabled = role[key];
        return (
          <span
            key={key}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
              enabled
                ? "bg-[#1a2f6e] text-white"
                : "bg-slate-100 text-slate-400"
            }`}
            title={`Module ${label}${enabled ? "" : " (no access)"}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** Loading skeleton — matches list row height to avoid layout shift */
function RolesSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="animate-pulse divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-5">
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-64 rounded bg-slate-100" />
            </div>
            <div className="hidden md:flex gap-1.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-6 w-6 rounded-md bg-slate-100" />
              ))}
            </div>
            <div className="h-4 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
