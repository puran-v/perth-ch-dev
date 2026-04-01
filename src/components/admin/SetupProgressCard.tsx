import React from 'react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { SetupStepper, type StepperStep } from '../ui/SetupStepper';

interface SetupProgressCardProps {
  title: string;
  completedCount: number;
  totalCount: number;
  steps: StepperStep[];
  onStepClick?: (step: StepperStep) => void;
  className?: string;
}

export function SetupProgressCard({
  title,
  completedCount,
  totalCount,
  steps,
  onStepClick,
  className = '',
}: SetupProgressCardProps) {
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {/* Green checkmark icon */}
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-green-600">
            {completedCount}/{totalCount} completed
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar value={progressPercent} variant="success" size="sm" className="mb-8" />

      {/* Stepper */}
      <SetupStepper steps={steps} onStepClick={onStepClick} />
    </Card>
  );
}
