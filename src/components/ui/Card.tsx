import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: boolean;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export function Card({
  children,
  className = '',
  padding = 'md',
  border = true,
  shadow = false,
}: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-lg',
        PADDING_MAP[padding],
        border ? 'border border-slate-200' : '',
        shadow ? 'shadow-sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
