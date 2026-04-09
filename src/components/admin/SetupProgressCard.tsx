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
    <Card className={className} padding="lg">
      {/* Author: samir */}
      {/* Impact: header wraps on small screens; progress bar margin reduced on mobile */}
      {/* Reason: header text was truncating on 320px screens */}
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-sm font-medium text-green-600 text-">
          {completedCount} / {totalCount} complete
        </span>
      </div>

      {/* Progress Bar */}
      <ProgressBar value={progressPercent} variant="success" size="md" className="mb-4 sm:mb-8" />

      {/* Stepper */}
      <SetupStepper steps={steps} onStepClick={onStepClick} />
    </Card>
  );
}
