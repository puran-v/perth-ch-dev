'use client';

import React from 'react';

export interface StepperStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  stepNumber: number;
}

interface SetupStepperProps {
  steps: StepperStep[];
  className?: string;
  onStepClick?: (step: StepperStep) => void;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function SetupStepper({ steps, className = '', onStepClick }: SetupStepperProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step */}
            <div
              className="flex flex-col items-center gap-2 cursor-pointer group"
              onClick={() => onStepClick?.(step)}
            >
              {/* Circle */}
              <div
                className={[
                  'flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all',
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'current'
                    ? 'bg-[#042E93] text-white ring-4 ring-blue-100'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
                ].join(' ')}
              >
                {step.status === 'completed' ? <CheckIcon /> : step.stepNumber}
              </div>
              {/* Label */}
              <span
                className={[
                  'text-xs font-medium whitespace-nowrap',
                  step.status === 'completed'
                    ? 'text-green-600'
                    : step.status === 'current'
                    ? 'text-[#042E93]'
                    : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-3 mb-6">
                <div
                  className={[
                    'h-0.5 w-full rounded-full',
                    step.status === 'completed' ? 'bg-green-500' : 'bg-slate-200',
                  ].join(' ')}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
