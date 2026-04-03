'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

// Author: samir
// Impact: Replaced unreliable native time input overlay with a custom TimePicker dropdown
// Reason: Native <input type="time"> with opacity-0 overlay was inconsistent — clicks sometimes didn't trigger the picker

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

function to24h(hours: number, minutes: number, period: string): string {
  let h = hours;
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TimePicker({ label, value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = formatTime12h(value);
  const selectedHour = Number(parsed.hours);
  const selectedMinute = Number(parsed.minutes);
  const selectedPeriod = parsed.period;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selectHour(h: number) {
    onChange(to24h(h, selectedMinute, selectedPeriod));
  }

  function selectMinute(m: number) {
    onChange(to24h(selectedHour, m, selectedPeriod));
  }

  function togglePeriod() {
    const newPeriod = selectedPeriod === 'AM' ? 'PM' : 'AM';
    onChange(to24h(selectedHour, selectedMinute, newPeriod));
  }

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'flex items-center gap-2 rounded-full border bg-white px-4 h-12 transition-colors cursor-pointer w-full text-left',
          open
            ? 'border-[#1a2f6e] ring-2 ring-[#1a2f6e]/20'
            : 'border-gray-200 hover:border-gray-300',
        ].join(' ')}
        aria-label={label}
        aria-expanded={open}
      >
        <span className="flex-1 text-sm text-gray-900 flex items-center gap-1">
          <span>{parsed.hours}</span>
          <span className="text-gray-400">:</span>
          <span>{parsed.minutes}</span>
          <span className="ml-1 text-gray-500">{parsed.period}</span>
        </span>
        <span className="text-gray-400 shrink-0">
          <ClockIcon />
        </span>
      </button>

      {open && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 min-w-[280px]">
            {/* Current selected time display */}
            <div className="flex items-center justify-center gap-1 mb-3 text-body-lg font-semibold text-gray-900">
              <span>{parsed.hours}</span>
              <span className="text-gray-400">:</span>
              <span>{parsed.minutes}</span>
              <button
                type="button"
                onClick={togglePeriod}
                className="ml-2 px-2 py-0.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                {parsed.period}
              </button>
            </div>

            <div className="flex gap-3">
              {/* Hours column */}
              <div className="flex-1">
                <p className="text-body-xs font-medium text-gray-400 mb-1.5 text-center uppercase tracking-wide">Hr</p>
                <div className="grid grid-cols-4 gap-1">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => selectHour(h)}
                      className={[
                        'h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                        h === selectedHour
                          ? 'bg-[#1a2f6e] text-white'
                          : 'text-gray-700 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="w-px bg-gray-200" />

              {/* Minutes column */}
              <div className="flex-1">
                <p className="text-body-xs font-medium text-gray-400 mb-1.5 text-center uppercase tracking-wide">Min</p>
                <div className="grid grid-cols-4 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMinute(m)}
                      className={[
                        'h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                        m === selectedMinute
                          ? 'bg-[#1a2f6e] text-white'
                          : 'text-gray-700 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Done button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full h-9 rounded-full bg-[#1a2f6e] text-white text-sm font-medium hover:bg-[#1a2f6e]/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
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
          <TimePicker
            label="Earliest start time"
            value={formData.earliestStartTime}
            onChange={(val) => updateField('earliestStartTime', val)}
          />
          <TimePicker
            label="Latest return time"
            value={formData.latestReturnTime}
            onChange={(val) => updateField('latestReturnTime', val)}
          />
        </div>
      </div>
    </Card>
  );
}
