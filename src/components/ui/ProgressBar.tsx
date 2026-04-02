import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const VARIANT_COLORS = {
  primary: 'bg-[#042E93]',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
} as const;

const SIZE_MAP = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const;

const TRACK_COLOR = 'bg-slate-100';

export function ProgressBar({
  value,
  max = 100,
  variant = 'success',
  size = 'md',
  showLabel = false,
  label,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-slate-700">
              {label}
            </span>
          )}
          {showLabel && (
            <span className="text-sm font-medium text-slate-600">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${TRACK_COLOR} rounded-full overflow-hidden ${SIZE_MAP[size]}`}
      >
        <div
          className={`${VARIANT_COLORS[variant]} ${SIZE_MAP[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
