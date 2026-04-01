import React from 'react';
import { StatsCard } from '../ui/StatsCard';

export interface DashboardStat {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface DashboardStatsGridProps {
  stats: DashboardStat[];
  className?: string;
}

export function DashboardStatsGrid({
  stats,
  className = '',
}: DashboardStatsGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {stats.map((stat) => (
        <StatsCard
          key={stat.id}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          trend={stat.trend}
          variant={stat.variant}
        />
      ))}
    </div>
  );
}
