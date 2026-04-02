import React from 'react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'completed' | 'in-progress' | 'pending';
  description?: string;
}

interface DashboardProgressSectionProps {
  title: string;
  subtitle?: string;
  overallProgress: number;
  steps: ProgressStep[];
  className?: string;
}

const STATUS_BADGE_MAP = {
  completed: { variant: 'success' as const, label: 'Completed' },
  'in-progress': { variant: 'info' as const, label: 'In Progress' },
  pending: { variant: 'neutral' as const, label: 'Pending' },
} as const;

function StepIcon({ status }: { status: ProgressStep['status'] }) {
  if (status === 'completed') {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100">
        <div className="w-2 h-2 rounded-full bg-[#042E93]" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100">
      <div className="w-2 h-2 rounded-full bg-slate-400" />
    </div>
  );
}

export function DashboardProgressSection({
  title,
  subtitle,
  overallProgress,
  steps,
  className = '',
}: DashboardProgressSectionProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <Badge variant="success">{overallProgress}% Complete</Badge>
      </div>

      <ProgressBar
        value={overallProgress}
        variant="success"
        size="md"
        className="mb-6"
      />

      <div className="space-y-4">
        {steps.map((step) => {
          const badgeConfig = STATUS_BADGE_MAP[step.status];
          return (
            <div
              key={step.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                <StepIcon status={step.status} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
