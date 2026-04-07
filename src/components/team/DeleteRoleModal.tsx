"use client";

/**
 * DeleteRoleModal — confirms soft-deletion of an OrganizationRole.
 *
 * Handles the 409 ROLE_IN_USE response by switching the modal into a
 * "blocked" state that shows how many users and pending invitations
 * still reference the role (V1 does not offer reassignment inline —
 * admins are told to reassign first, then retry).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Author: Puran
// Impact: dedicated confirm modal that understands the ROLE_IN_USE 409 payload
// Reason: V1 spec — block delete + show counts, no inline reassignment

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useDeleteRole } from "@/hooks/team/useRoles";
import { ApiError } from "@/lib/api-client";
import type { OrganizationRole, RoleInUseDetails } from "@/types/team";

interface DeleteRoleModalProps {
  open: boolean;
  onClose: () => void;
  role: OrganizationRole | null;
}

/**
 * Renders a confirmation modal for deleting a role.
 * On 409 ROLE_IN_USE, swaps body content to show blocking counts
 * instead of the delete confirmation.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function DeleteRoleModal({ open, onClose, role }: DeleteRoleModalProps) {
  const deleteRole = useDeleteRole(role?.id ?? "");
  const [inUse, setInUse] = useState<RoleInUseDetails | null>(null);

  // Reset state whenever the modal re-opens for a different role
  useEffect(() => {
    if (open) setInUse(null);
  }, [open, role?.id]);

  /**
   * Runs the delete mutation. On 409 ROLE_IN_USE, stores the counts
   * and flips the modal into blocked state. On other errors, toasts.
   */
  const handleConfirm = async () => {
    if (!role) return;
    try {
      await deleteRole.mutateAsync();
      toast.success(`Role "${role.name}" deleted.`);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "ROLE_IN_USE") {
        const details = (err.details as RoleInUseDetails | undefined) ?? {
          userCount: 0,
          inviteCount: 0,
        };
        setInUse(details);
        return;
      }
      const message =
        err instanceof ApiError ? err.message : "Failed to delete role.";
      toast.error(message);
    }
  };

  if (!role) return null;

  const isBlocked = inUse !== null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBlocked ? "Can't delete this role" : "Delete role"}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteRole.isPending}
          >
            {isBlocked ? "Close" : "Cancel"}
          </Button>
          {!isBlocked && (
            <Button
              type="button"
              onClick={handleConfirm}
              loading={deleteRole.isPending}
              className="!bg-red-600 hover:!bg-red-700 !text-white"
            >
              Delete role
            </Button>
          )}
        </div>
      }
    >
      {isBlocked ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{role.name}</span> is still assigned
            and can&apos;t be deleted yet.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ul className="flex flex-col gap-1 text-sm text-amber-900">
              <li>
                <span className="font-semibold">{inUse.userCount}</span>{" "}
                active user{inUse.userCount === 1 ? "" : "s"}
              </li>
              <li>
                <span className="font-semibold">{inUse.inviteCount}</span>{" "}
                pending invitation{inUse.inviteCount === 1 ? "" : "s"}
              </li>
            </ul>
          </div>
          <p className="text-sm text-slate-500">
            Reassign these members to another role, then try deleting again.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{role.name}</span>? This can&apos;t
            be undone from the UI.
          </p>
          {role.description && (
            <p className="text-xs text-slate-500">{role.description}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
