'use client';


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

function CompletedStepIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
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

export function SetupStepper({ steps, className = '', onStepClick }: SetupStepperProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-around">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => onStepClick?.(step)}
          >
            {/* Circle */}
            {step.status === 'completed' ? (
              <CompletedStepIcon />
            ) : (
              <div
                className={[
                  'flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all',
                  step.status === 'current'
                    ? 'bg-[#042E9333] text-[#042E93]'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
                ].join(' ')}
              >
                {step.stepNumber}
              </div>
            )}
            {/* Label */}
            <span
              className={[
                'text-xs font-medium whitespace-nowrap',
                step.status === 'completed'
                  ? 'text-green-600'
                  : step.status === 'current'
                  ? 'text-[#042E93] font-normal'
                  : 'text-slate-400',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
