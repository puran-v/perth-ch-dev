import React from 'react';

interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_COLORS = {
  online: 'bg-green-500',
  offline: 'bg-slate-300',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
} as const;

const SIZE_MAP = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
} as const;

export function StatusDot({
  status,
  size = 'md',
  className = '',
}: StatusDotProps) {
  return (
    <span
      className={`inline-block rounded-full ${STATUS_COLORS[status]} ${SIZE_MAP[size]} ${className}`}
      aria-label={status}
    />
  );
}
