"use client";

/**
 * RoleFormModal — create or edit an OrganizationRole.
 *
 * Handles both create and edit modes depending on whether an `initialRole`
 * is passed. Toggles for Module A-E access flags match the V1 spec.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */

// Author: Puran
// Impact: single component handles both create and edit role flows
// Reason: same form shape — only initial values + submit handler differ

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import { useCreateRole, useUpdateRole } from "@/hooks/team/useRoles";
import type { OrganizationRole, RoleInput } from "@/types/team";

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the modal is in "edit" mode — otherwise it creates a new role */
  initialRole?: OrganizationRole | null;
}

/** Module flag definitions matching the V1 spec */
const MODULES: { key: keyof Pick<RoleInput, "moduleA" | "moduleB" | "moduleC" | "moduleD" | "moduleE">; label: string; description: string }[] = [
  { key: "moduleA", label: "Module A — Quoting & Booking", description: "Create quotes, manage bookings, approve orders" },
  { key: "moduleB", label: "Module B — Inventory", description: "Stock levels, substitution rules, cross-hire" },
  { key: "moduleC", label: "Module C — Warehouse", description: "Loading tasks, readiness checks, dispatch" },
  { key: "moduleD", label: "Module D — Finance", description: "Invoices, payments, dispatch holds" },
  { key: "moduleE", label: "Module E — Reports", description: "Dashboards and analytics" },
];

/**
 * Renders a modal form for creating or editing a role.
 * Validates name (required, 1-80 chars) client-side before submitting.
 *
 * @param open - Modal open state
 * @param onClose - Close callback
 * @param initialRole - If set, modal edits this role; otherwise creates
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Components
 */
export function RoleFormModal({ open, onClose, initialRole }: RoleFormModalProps) {
  const isEdit = Boolean(initialRole);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState({
    moduleA: false,
    moduleB: false,
    moduleC: false,
    moduleD: false,
    moduleE: false,
  });
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});

  const createRole = useCreateRole();
  const updateRole = useUpdateRole(initialRole?.id ?? "");
  const loading = createRole.isPending || updateRole.isPending;

  // Reset form when modal opens or role changes
  useEffect(() => {
    if (!open) return;
    setName(initialRole?.name ?? "");
    setDescription(initialRole?.description ?? "");
    setModules({
      moduleA: initialRole?.moduleA ?? false,
      moduleB: initialRole?.moduleB ?? false,
      moduleC: initialRole?.moduleC ?? false,
      moduleD: initialRole?.moduleD ?? false,
      moduleE: initialRole?.moduleE ?? false,
    });
    setErrors({});
  }, [open, initialRole]);

  /**
   * Validates + submits the role. On success, shows a toast and closes.
   * Handles ROLE_NAME_EXISTS (409) by setting a name-specific error.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrors({ name: "Role name is required." });
      return;
    }
    if (trimmedName.length > 80) {
      setErrors({ name: "Role name must be 80 characters or less." });
      return;
    }

    setErrors({});

    const payload: RoleInput = {
      name: trimmedName,
      description: description.trim() || null,
      ...modules,
    };

    try {
      if (isEdit) {
        await updateRole.mutateAsync(payload);
        toast.success(`Role "${trimmedName}" updated.`);
      } else {
        await createRole.mutateAsync(payload);
        toast.success(`Role "${trimmedName}" created.`);
      }
      onClose();
    } catch (err: unknown) {
      // Handle unique-name conflict specifically
      const apiErr = err as { code?: string; message?: string };
      if (apiErr.code === "ROLE_NAME_EXISTS") {
        setErrors({ name: "A role with this name already exists." });
      } else {
        setErrors({ general: apiErr.message ?? "Something went wrong. Please try again." });
        toast.error(apiErr.message ?? "Failed to save role.");
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit role" : "Create role"}
      description={
        isEdit
          ? "Update role name and module access."
          : "Give your role a name and choose which modules it can access."
      }
      size="lg"
      footer={
        // Stretch both buttons full-width on narrow widths so the primary
        // CTA is thumb-friendly and can't overflow the modal. From sm+
        // they revert to right-aligned auto-width pills.
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            fullWidth
            className="sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="role-form"
            loading={loading}
            fullWidth
            className="sm:w-auto"
          >
            {isEdit ? "Save changes" : "Create role"}
          </Button>
        </div>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Role name</p>
          <Input
            type="text"
            placeholder="e.g. Floor Manager"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoFocus
            disabled={loading}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role does in your organization"
            rows={2}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Module access</p>
          <p className="mb-3 text-xs text-slate-500">
            Select which modules users with this role can access. You can change this later.
          </p>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            {MODULES.map(({ key, label, description: desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div className="pt-0.5">
                  <Checkbox
                    checked={modules[key]}
                    onChange={(e) =>
                      setModules((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    disabled={loading}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
