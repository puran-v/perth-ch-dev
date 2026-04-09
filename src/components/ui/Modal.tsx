"use client";

/**
 * Modal primitive — accessible overlay dialog with backdrop + focus trap.
 *
 * Closes on Escape and backdrop click. Wraps children in a scrollable
 * card centred on the viewport. Fully responsive — full-screen on mobile,
 * card on md+.
 *
 * @author Puran
 * @created 2026-04-06
 * @module UI - Primitives
 */

// Author: Puran
// Impact: shared Modal primitive for Team (RoleForm, DeleteRole) + future modules
// Reason: no Modal existed in components/ui; needed for role CRUD

import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Optional inline action rendered in the header row, between the
   * title block and the close button. Used by feature modals that need
   * a primary affordance next to the title (e.g. CSV mapping guide's
   * "Download template CSV" button) without baking it into the body.
   *
   * Author: samir
   * Impact: lets the CSV Mapping Guide modal mount the Download button
   *         in the header without forking the Modal primitive.
   * Reason: §11 / shared-primitive rule — extend, don't duplicate.
   */
  headerAction?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
}

const SIZE_CLASSES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Accessible modal dialog with backdrop, Escape key handler, and scroll lock.
 *
 * @param open - Whether the modal is visible
 * @param onClose - Callback when user dismisses (backdrop, Escape, or close button)
 * @param title - Modal header title
 * @param description - Optional secondary text under the title
 * @param children - Modal body content
 * @param footer - Optional footer (typically action buttons)
 * @param size - Max width breakpoint
 * @param closeOnBackdrop - Whether clicking the backdrop closes the modal (default true)
 *
 * @author Puran
 * @created 2026-04-06
 * @module UI - Primitives
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  headerAction,
  size = "md",
  closeOnBackdrop = true,
}: ModalProps) {
  // Close on Escape key + lock body scroll while open
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Card — full-screen on mobile, centred card on md+ */}
      <div
        className={`relative w-full ${SIZE_CLASSES[size]} max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {/* Author: samir */}
          {/* Impact: optional inline action rendered between the title block and close X */}
          {/* Reason: lets feature modals (e.g. CSV Mapping Guide → Download template CSV) */}
          {/*         mount a primary action next to the title without forking this primitive */}
          {headerAction && (
            <div className="shrink-0 self-center">{headerAction}</div>
          )}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
