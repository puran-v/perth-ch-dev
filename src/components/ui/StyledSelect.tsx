"use client";

/**
 * StyledSelect — pill-shaped native select that matches the Input primitive.
 *
 * The project's Input primitive is `h-12 rounded-full` (pill) with the brand
 * focus ring. Native `<select>` elements default to `appearance: auto` which
 * renders the browser's own chevron and ignores border-radius on some engines —
 * mixing a raw select next to an Input creates the visual mismatch seen on
 * the Invite tab (different height, different shape, platform chevron).
 *
 * This component fixes all of that in one place by:
 *   - Applying `appearance-none` to hide the native chevron
 *   - Matching h-12, rounded-full, and focus-ring colors to Input
 *   - Overlaying a single consistent SVG chevron on the right
 *   - Leaving the rest of the `<select>` API untouched so callers pass
 *     children <option> just like a native select
 *
 * @author Puran
 * @created 2026-04-06
 * @module UI - Primitives
 */

// Author: Puran
// Impact: shared pill select so every form in Team & Users (Invite, Edit
//         Member, any future one) lines up with the Input primitive.
// Reason: InviteTab row looked broken because the raw <select> was h-11
//         rounded-xl while the Input next to it was h-12 rounded-full —
//         plus the native chevron made the dropdown look cramped. One
//         shared component prevents this drift from ever happening again.

import React from "react";

interface StyledSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  /** Shown in red below the field when set — same error UX as Input */
  error?: string;
  /** Optional extra classes for the outer wrapper */
  wrapperClassName?: string;
  /** Optional extra classes for the select itself */
  className?: string;
}

/**
 * Native `<select>` styled to look like the Input pill.
 *
 * Use it exactly like a native select — pass `value`, `onChange`, and
 * `<option>` children as usual. The chevron and focus states are handled
 * automatically.
 *
 * @author Puran
 * @created 2026-04-06
 * @module UI - Primitives
 */
export function StyledSelect({
  error,
  wrapperClassName = "",
  className = "",
  children,
  disabled,
  ...props
}: StyledSelectProps) {
  return (
    <div className={`flex w-full flex-col gap-1.5 ${wrapperClassName}`}>
      <div className="relative w-full">
        <select
          disabled={disabled}
          className={[
            // Match Input: h-12, rounded-full, border, focus ring
            "h-12 w-full rounded-full border bg-white px-4 pr-10 text-sm text-slate-900 transition-colors",
            // Hide the browser default chevron
            "appearance-none",
            // Dedicated classes for WebKit + Gecko + Edge legacy
            "[&::-ms-expand]:hidden",
            error
              ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200 focus:outline-none"
              : "border-slate-200 focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 focus:outline-none",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
        </select>

        {/* Custom chevron — absolutely positioned on the right so it sits
            inside the pill no matter how wide the select is. pointer-events
            disabled so clicks fall through to the select. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
