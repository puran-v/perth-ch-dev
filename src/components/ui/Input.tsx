"use client";

import React, { useState } from "react";

// dev (jay): shared input primitive — keeps form styling consistent across auth pages
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode; // dev (jay): slot for toggle buttons (e.g. show/hide password)
  /** Merged into the inner input element (e.g. text-base for table rows). */
  inputClassName?: string;
}

export default function Input({
  label,
  error,
  icon,
  rightElement,
  inputClassName = "",
  className = "",
  id,
  ...props
}: InputProps) {
  // dev (jay): auto-generate id from label so htmlFor links correctly without requiring caller to pass id
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <div
        className={[
          "flex items-center gap-2 rounded-full border bg-white px-4 h-12 transition-colors",
          // dev (jay): red ring on error state, brand blue on focus — clear visual feedback for validation
          error
            ? "border-red-400 focus-within:ring-2 focus-within:ring-red-300"
            : "border-gray-200 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {icon && (
          <span className="text-gray-400 shrink-0 flex items-center">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          // dev (jay): min-w-0 prevents flex overflow on small screens
          className={[
            "flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0",
            inputClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {rightElement && (
          <span className="text-gray-400 shrink-0 flex items-center">
            {rightElement}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

// dev (jay): wraps Input — hides type/rightElement from caller, owns visibility state internally
type PasswordInputProps = Omit<InputProps, "type" | "rightElement">

export function PasswordInput({ icon, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  // dev (jay): inline SVG avoids an icon lib dep; swaps paths based on visible state
  const EyeIcon = () => <img src={`${visible ?  "/assets/icons/eye.svg": "/assets/icons/eye-off.svg"}`} alt="" className="w-5 h-5" />

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      icon={icon}
      rightElement={
        // dev (jay): type="button" prevents accidental form submit on click
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="cursor-pointer hover:text-gray-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {EyeIcon()}
        </button>
      }
    />
  );
}
