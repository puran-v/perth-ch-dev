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
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-sm font-medium text-blue-600">
          {completedCount} / {totalCount} complete
        </span>
      </div>

      {/* Progress Bar */}
      <ProgressBar value={progressPercent} variant="success" size="md" className="mb-8" />

      {/* Stepper */}
      <SetupStepper steps={steps} onStepClick={onStepClick} />
    </Card>
  );
}
