"use client";

import React, { useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export default function Input({
  label,
  error,
  icon,
  rightElement,
  className = "",
  id,
  ...props
}: InputProps) {
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
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
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

interface PasswordInputProps extends Omit<InputProps, "type" | "rightElement"> {}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const EyeIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {visible ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  const LockIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      icon={<LockIcon />}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="cursor-pointer hover:text-gray-600 transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <EyeIcon />
        </button>
      }
    />
  );
}
