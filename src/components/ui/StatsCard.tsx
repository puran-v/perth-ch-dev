import React from 'react';
import { Card } from './Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const ICON_BG_MAP = {
  default: 'bg-slate-100',
  success: 'bg-green-50',
  warning: 'bg-amber-50',
  danger: 'bg-red-50',
  info: 'bg-blue-50',
} as const;

const ICON_COLOR_MAP = {
  default: 'text-slate-600',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-blue-600',
} as const;

const TREND_COLOR_MAP = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-slate-500',
} as const;

export function StatsCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
  className = '',
}: StatsCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-sm font-medium ${TREND_COLOR_MAP[trend.direction]}`}
              >
                {trend.direction === 'up' && '↑'}
                {trend.direction === 'down' && '↓'}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-xs text-slate-400">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl ${ICON_BG_MAP[variant]} ${ICON_COLOR_MAP[variant]}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
