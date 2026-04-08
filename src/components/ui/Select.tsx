"use client";

// Old Author: samir
// New Author: samir
// Impact: replaced the native <select> wrapper with a custom popover dropdown matching the
//         warehouse multi-select styling (rounded-3xl trigger, brand-blue ring, popover listbox
//         with check-mark rows, click-outside dismissal). Single-select only — there is a
//         dedicated WarehouseMultiSelect inside WarehouseLocationForm for the array case.
// Reason: native selects on the org-setup page rendered as the OS-default control, which broke
//         visual parity with the rest of the form (rounded-3xl inputs + warehouse picker). The
//         public API is unchanged so BusinessInfoForm + PaymentInvoiceForm consume it without
//         any edits.

import React, { useEffect, useRef, useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
}

/**
 * Chevron icon used in the trigger. Rotates 180° when the popover is open
 * to give a clear "you can close me by clicking again" affordance — same
 * pattern used by the warehouse multi-select and TimePicker.
 *
 * @author samir
 * @created 2026-04-08
 * @module Shared - UI
 */
function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tick icon shown next to the currently-selected option inside the popover.
 *
 * @author samir
 * @created 2026-04-08
 * @module Shared - UI
 */
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 6L5 8.5L9.5 4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Single-select dropdown with a custom popover. Visually matches the
 * warehouse multi-select used in WarehouseLocationForm: rounded-3xl
 * trigger, brand-blue focus ring, rounded-2xl popover with check-mark
 * rows, click-outside to dismiss.
 *
 * Public API is identical to the previous native-select-based component
 * so existing call sites (BusinessInfoForm, PaymentInvoiceForm) need no
 * changes.
 *
 * Accessibility:
 * - Trigger button uses aria-haspopup="listbox" + aria-expanded.
 * - Popover is a role="listbox"; rows are role="option" with aria-selected.
 * - Keyboard: Enter/Space on the trigger toggles open. Esc closes.
 *   Enter/Space on a row selects + closes.
 *
 * @param label - Visible label rendered above the trigger
 * @param options - Array of { value, label } pairs
 * @param value - Currently selected value (controlled)
 * @param onChange - Called with the new value when an option is picked
 * @param placeholder - Text shown when no value is selected
 * @param error - Optional error message; flips border to red when set
 * @param required - Renders a red asterisk after the label
 * @param disabled - Disables the trigger and prevents opening
 * @param className - Extra classes for the outer wrapper
 * @param name - Optional name (kept for legacy parity, no longer rendered as a hidden input)
 *
 * @author samir
 * @created 2026-04-08
 * @module Shared - UI
 */
export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  required = false,
  disabled = false,
  className = "",
  name,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable id for label htmlFor — derived from the label text the same
  // way the previous native-select implementation did, so any external
  // CSS / tests targeting the id keep working.
  const id = label
    ? label
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    : undefined;

  // Click-outside to dismiss. Mirrors WarehouseMultiSelect / TimePicker.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Esc to close — common a11y expectation for popover widgets.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const selected = options.find((opt) => opt.value === value);

  function handleSelect(next: string) {
    onChange?.(next);
    setOpen(false);
  }

  return (
    <div
      className={`flex flex-col gap-1.5 w-full ${className}`}
      ref={containerRef}
    >
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger button. Uses h-12 to match the Input + warehouse trigger
          height so adjacent fields line up cleanly in the form grid. */}
      <button
        id={id}
        name={name || id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={[
          "flex items-center gap-2 rounded-3xl border bg-white px-4 h-12 transition-colors w-full text-left cursor-pointer",
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-gray-200"
            : error
              ? "border-red-400 focus-within:ring-2 focus-within:ring-red-300"
              : open
                ? "border-[#1a2f6e] ring-2 ring-[#1a2f6e]/20"
                : "border-gray-200 hover:border-gray-300 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-disabled={disabled}
      >
        <span
          className={[
            "flex-1 truncate text-sm",
            selected ? "text-slate-900" : "text-gray-400",
          ].join(" ")}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="shrink-0 self-center">
          <ChevronDownIcon open={open} />
        </span>
      </button>

      {/* Popover listbox — same rounded-2xl + shadow-lg as the warehouse
          multi-select so the two controls feel like a matched set. */}
      {open && !disabled && (
        <div className="relative z-50">
          <div
            role="listbox"
            aria-label={label}
            className="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg p-2 min-w-[200px] max-h-72 overflow-y-auto"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={[
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer",
                    isSelected ? "bg-[#1a2f6e]/5" : "hover:bg-gray-100",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex items-center justify-center w-4 h-4 rounded-full border transition-colors shrink-0",
                      isSelected
                        ? "bg-[#1a2f6e] border-[#1a2f6e]"
                        : "bg-white border-gray-300",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isSelected && <CheckIcon />}
                  </span>
                  <span
                    className={
                      isSelected
                        ? "text-gray-900 font-medium"
                        : "text-gray-700"
                    }
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
