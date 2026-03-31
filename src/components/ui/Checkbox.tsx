import React from "react";

// dev (jay): custom checkbox — appearance-none hides native UI so we can style it consistently cross-browser
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Checkbox({ label, id, className = "", ...props }: CheckboxProps) {
  // dev (jay): same id-from-label pattern as Input — avoids requiring callers to pass id manually
  const checkboxId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    // dev (jay): label wraps input so clicking the text also toggles the checkbox
    <label
      htmlFor={checkboxId}
      className="flex items-center gap-2 cursor-pointer select-none group"
    >
      <div className="relative flex items-center">
        <input
          id={checkboxId}
          type="checkbox"
          className={[
            "peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-colors",
            // dev (jay): peer-* lets the SVG checkmark react to checked state via CSS only — no JS needed
            "checked:bg-[#1a2f6e] checked:border-[#1a2f6e]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3.5 8l3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {label && (
        <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
          {label}
        </span>
      )}
    </label>
  );
}
