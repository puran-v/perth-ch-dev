'use client';

import Link from 'next/link';

export interface StepperStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  stepNumber: number;
  // Author: samir
  // Impact: step circles can link directly to their configuration page
  // Reason: setup progress should be navigable — clicking a step should take the user straight to that module's page
  href?: string;
}

interface SetupStepperProps {
  steps: StepperStep[];
  className?: string;
  onStepClick?: (step: StepperStep) => void;
}

function CompletedStepIcon() {
  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center">
      <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth={1.5} fill="none" />
        <path
          d="M8 12.5l2.5 2.5 5.5-5.5"
          stroke="#16a34a"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// Author: samir
// Impact: stepper scrolls horizontally on small screens instead of overflowing, and each step is now a Link when href is provided
// Reason: 6 steps at 320px caused layout overflow; now scrollable. Using Next.js Link gives prefetch, middle-click, and accessible keyboard navigation instead of JS-only onClick.
export function SetupStepper({ steps, className = '', onStepClick }: SetupStepperProps) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="flex items-center justify-around min-w-[400px] sm:min-w-0 gap-2 sm:gap-0 px-2 sm:px-0">
        {steps.map((step) => {
          const stepInner = (
            <>
              {/* Circle */}
              {step.status === 'completed' ? (
                <CompletedStepIcon />
              ) : (
                <div
                  className={[
                    'flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm font-semibold transition-all',
                    step.status === 'current'
                      ? 'bg-[#042E9333] text-[#042E93] group-hover:bg-[#042E9344]'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
                  ].join(' ')}
                >
                  {step.stepNumber}
                </div>
              )}
              {/* Label */}
              <span
                className={[
                  'text-[10px] sm:text-xs font-medium whitespace-nowrap',
                  step.status === 'completed'
                    ? 'text-green-600 group-hover:text-green-700'
                    : step.status === 'current'
                    ? 'text-[#042E93] font-normal'
                    : 'text-slate-400 group-hover:text-slate-500',
                ].join(' ')}
              >
                {step.label}
              </span>
            </>
          );

          const sharedClass =
            'flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#042E93]/40';

          // Author: samir
          // Impact: prefer Link navigation when href is set; fall back to onStepClick for callers that still use the callback
          // Reason: navigation is the standard case for a setup stepper; keeping onStepClick keeps the component flexible
          if (step.href) {
            return (
              <Link
                key={step.id}
                href={step.href}
                aria-label={`Go to ${step.label}`}
                aria-current={step.status === 'current' ? 'step' : undefined}
                className={sharedClass}
                onClick={() => onStepClick?.(step)}
              >
                {stepInner}
              </Link>
            );
          }

          return (
            <div
              key={step.id}
              role={onStepClick ? 'button' : undefined}
              tabIndex={onStepClick ? 0 : undefined}
              aria-current={step.status === 'current' ? 'step' : undefined}
              className={sharedClass}
              onClick={() => onStepClick?.(step)}
              onKeyDown={(e) => {
                if (onStepClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onStepClick(step);
                }
              }}
            >
              {stepInner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
