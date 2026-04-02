'use client';

import { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import Input from '../ui/Input';

export interface WarehouseFormData {
  warehouseAddress: string;
  earliestStartTime: string;
  latestReturnTime: string;
}

interface WarehouseLocationFormProps {
  initialData?: Partial<WarehouseFormData>;
  saved?: boolean;
  className?: string;
}

const INITIAL_FORM_STATE: WarehouseFormData = {
  warehouseAddress: '',
  earliestStartTime: '06:00',
  latestReturnTime: '20:00',
};

function formatTime12h(time24: string): { hours: string; minutes: string; period: string } {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    hours: String(hours12).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    period,
  };
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="#94A3B8" strokeWidth="1.5" />
      <path d="M10 5.5V10L13 12.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="#3B82F6" strokeWidth="1.5" />
      <path d="M10 9V14" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="#3B82F6" />
    </svg>
  );
}

export function WarehouseLocationForm({
  initialData,
  saved = false,
  className = '',
}: WarehouseLocationFormProps) {
  const [formData, setFormData] = useState<WarehouseFormData>({
    ...INITIAL_FORM_STATE,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WarehouseFormData, string>>>({});

  const updateField = useCallback(
    (field: keyof WarehouseFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const startTime = formatTime12h(formData.earliestStartTime);
  const returnTime = formatTime12h(formData.latestReturnTime);

  return (
    <Card className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-slate-900">Warehouse Location</h2>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.3 4.3L6 11.6L2.7 8.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-6">
        <span className="mt-0.5 shrink-0">
          <InfoIcon />
        </span>
        <p className="text-sm text-slate-700">
          Used as the departure point for all runs in the scheduling tool and for distance-based pricing rules.
        </p>
      </div>

      <div className="space-y-5">
        {/* Warehouse address */}
        <Input
          label="Warehouse address*"
          value={formData.warehouseAddress}
          onChange={(e) => updateField('warehouseAddress', e.target.value)}
          placeholder="Perth, Western Australia"
          error={errors.warehouseAddress}
        />

        {/* Time fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Earliest start time */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-gray-700">Earliest start time</label>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20 transition-colors">
              <span className="flex-1 text-sm text-gray-900 flex items-center gap-1">
                <span>{startTime.hours}</span>
                <span className="text-gray-400">:</span>
                <span>{startTime.minutes}</span>
                <span className="ml-1 text-gray-500">{startTime.period}</span>
              </span>
              <input
                type="time"
                value={formData.earliestStartTime}
                onChange={(e) => updateField('earliestStartTime', e.target.value)}
                className="absolute opacity-0 w-0 h-0"
                tabIndex={-1}
              />
              <span className="text-gray-400 shrink-0">
                <ClockIcon />
              </span>
            </div>
          </div>

          {/* Latest return time */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-gray-700">Latest return time</label>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20 transition-colors">
              <span className="flex-1 text-sm text-gray-900 flex items-center gap-1">
                <span>{returnTime.hours}</span>
                <span className="text-gray-400">:</span>
                <span>{returnTime.minutes}</span>
                <span className="ml-1 text-gray-500">{returnTime.period}</span>
              </span>
              <input
                type="time"
                value={formData.latestReturnTime}
                onChange={(e) => updateField('latestReturnTime', e.target.value)}
                className="absolute opacity-0 w-0 h-0"
                tabIndex={-1}
              />
              <span className="text-gray-400 shrink-0">
                <ClockIcon />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
