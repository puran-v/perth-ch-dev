import React from 'react';

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

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error,
  required = false,
  disabled = false,
  className = '',
  name,
}: SelectProps) {
  const id = label
    ? label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={id}
        name={name || id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={[
          'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900',
          'appearance-none bg-no-repeat',
          'focus:outline-none focus:ring-2 focus:ring-[#042E93]/20 focus:border-[#042E93]',
          'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
          error
            ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
            : 'border-slate-200',
          'transition-colors',
        ].join(' ')}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 8px center',
          backgroundSize: '20px',
          paddingRight: '36px',
        }}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
