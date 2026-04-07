"use client";

/**
 * RevokeMemberModal — confirms soft-deletion of a team member.
 *
 * Destructive action — never single-click. The modal explains exactly
 * what's about to happen (loss of access, sessions ended) so the admin
 * can't blow someone out of the org by accident.
 *
 * Maps the backend's stable error codes to specific UX:
 *   - AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED → "promote another user first"
 *   - CANNOT_REVOKE_SELF → "ask another admin"
 *   - MEMBER_NOT_FOUND → already removed; close the modal silently
 *   - anything else → fallback toast
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Author: Puran
// Impact: confirmation dialog for the Users tab Revoke button
// Reason: revoking a member is destructive — needs an explicit confirm
//         step + clear consequences spelled out before the action fires

import { toast } from "react-toastify";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useRevokeMember } from "@/hooks/team/useMembers";
import { ApiError } from "@/lib/api-client";
import type { Member } from "@/types/team";

interface RevokeMemberModalProps {
  open: boolean;
  onClose: () => void;
  member: Member | null;
}

/**
 * Renders the revoke confirmation modal. Calls the DELETE endpoint on
 * confirm and closes itself on success or unrecoverable error.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function RevokeMemberModal({
  open,
  onClose,
  member,
}: RevokeMemberModalProps) {
  // Hooks must be called unconditionally — pass empty id when there's
  // no member; the mutation just won't be called in that case.
  const revoke = useRevokeMember(member?.id ?? "");

  /**
   * Fires the DELETE and routes errors to specific toasts.
   * On success the modal closes and the parent's React Query cache
   * (already in the hook's invalidateKeys) refetches the members list.
   */
  const handleConfirm = async () => {
    if (!member) return;
    try {
      const result = await revoke.mutateAsync();
      toast.success(result.message);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED") {
          toast.error(
            "You can't revoke the only admin. Promote another user to Admin first."
          );
          return;
        }
        if (err.code === "CANNOT_REVOKE_SELF") {
          toast.error(
            "You can't revoke your own access. Ask another admin to do it."
          );
          onClose();
          return;
        }
        if (err.code === "MEMBER_NOT_FOUND") {
          // Already gone — close the modal silently and let the cache
          // refetch reflect reality
          toast.info("This member is no longer in your organization.");
          onClose();
          return;
        }
        toast.error(err.message);
        return;
      }
      toast.error("Failed to revoke member.");
    }
  };

  if (!member) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revoke access"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={revoke.isPending}
            fullWidth
            className="sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            loading={revoke.isPending}
            fullWidth
            className="!bg-red-600 hover:!bg-red-700 !text-white sm:w-auto"
          >
            Revoke access
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-700">
          Revoke access for{" "}
          <span className="font-semibold text-slate-900">{member.fullName}</span>
          ?
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            What happens
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-900">
            <li>
              They&rsquo;ll lose access to the organization immediately.
            </li>
            <li>Every active login session will be ended.</li>
            <li>
              Their account is soft-deleted — data isn&rsquo;t erased, but
              they can&rsquo;t log back in until re-invited.
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          {member.email}
          {member.organizationRole?.isSystem && (
            <>
              {" "}
              — currently an admin. The save will be rejected if they&rsquo;re
              the only admin.
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}
