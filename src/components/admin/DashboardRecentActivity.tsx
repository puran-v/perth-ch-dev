import React from 'react';
import { Card } from '../ui/Card';

export interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  timestamp: string;
}

interface DashboardRecentActivityProps {
  title: string;
  activities: ActivityItem[];
  onViewAll?: () => void;
  className?: string;
}

export function DashboardRecentActivity({
  title,
  activities,
  onViewAll,
  className = '',
}: DashboardRecentActivityProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm font-medium text-[#042E93] hover:text-[#031F66] transition-colors"
          >
            View all →
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex-shrink-0 mt-0.5">{activity.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {activity.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {activity.description}
              </p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
              {activity.timestamp}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
