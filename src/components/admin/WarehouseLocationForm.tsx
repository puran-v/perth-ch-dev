'use client';

// Old Author: samir
// New Author: samir
// Impact: warehouse address is now a multi-select chip picker (3 static options) instead of a free-text single input
// Reason: tenants run jobs out of multiple depots — scheduling needs every warehouse they operate from. The 3 options are placeholder data until the Warehouse model + CRUD is built; the stored shape is an array of identifiers so swapping the source later is a drop-in change.

import {
  forwardRef,
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import { Card } from '../ui/Card';
import {
  warehouseLocationSchema,
  type WarehouseLocationInput,
} from '@/lib/validation/org-setup';

export interface WarehouseFormData {
  warehouseAddresses: string[];
  earliestStartTime: string;
  latestReturnTime: string;
}

// Author: samir
// Impact: placeholder warehouse catalogue — replace when the Warehouse model + API exist
// Reason: the org-setup page needs to ship before the full Warehouse CRUD; hardcoding 3 realistic options lets the UI be built and tested end-to-end. The `value` stays stable (depot code) while the `label` can be edited freely without invalidating previously-saved drafts.
interface WarehouseOption {
  value: string;
  label: string;
}

const WAREHOUSE_OPTIONS: readonly WarehouseOption[] = [
  { value: 'perth-cbd', label: 'Perth CBD — Unit 12, 45 Stirling Hwy' },
  { value: 'fremantle', label: 'Fremantle — 8 Marine Terrace' },
  { value: 'joondalup', label: 'Joondalup — 3 Grand Boulevard' },
] as const;

/** Imperative handle exposed to the parent via ref. */
export interface WarehouseLocationFormHandle {
  validate: () => WarehouseLocationInput | null;
  getFormData: () => WarehouseFormData;
}

interface WarehouseLocationFormProps {
  initialData?: Partial<WarehouseFormData>;
  saved?: boolean;
  className?: string;
}

// Sensible business defaults: a full 6am–8pm working window.
// Addresses start empty — user must pick at least one from the list.
const INITIAL_FORM_STATE: WarehouseFormData = {
  warehouseAddresses: [],
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

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6L8 10L12 6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// WarehouseMultiSelect
// ---------------------------------------------------------------------------

interface WarehouseMultiSelectProps {
  label: string;
  options: readonly WarehouseOption[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}

/**
 * Multi-select dropdown for picking one or more warehouse depots.
 * Matches the TimePicker styling pattern: rounded-full trigger button,
 * click-outside to dismiss, rounded-2xl popover with check-mark rows.
 * Each selected option renders as a chip inside the trigger.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
function WarehouseMultiSelect({
  label,
  options,
  value,
  onChange,
  error,
}: WarehouseMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside to dismiss — mirrors TimePicker's behaviour.
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

  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const hasSelection = selectedOptions.length > 0;

  function toggleOption(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function removeChip(optValue: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optValue));
  }

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Trigger button. Uses min-h-12 + py-1.5 so wrapped chips grow the
          box gracefully without breaking the rounded-full aesthetic of
          the rest of the form. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'flex items-start gap-2 rounded-3xl border bg-white px-4 py-1.5 min-h-12 transition-colors cursor-pointer w-full text-left',
          error
            ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-300'
            : open
            ? 'border-[#1a2f6e] ring-2 ring-[#1a2f6e]/20'
            : 'border-gray-200 hover:border-gray-300',
        ].join(' ')}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-9 py-0.5">
          {!hasSelection && (
            <span className="text-sm text-gray-400 self-center">Select one or more warehouses</span>
          )}
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded-full bg-[#1a2f6e]/10 text-[#1a2f6e] px-2.5 py-1 text-xs font-medium max-w-full"
            >
              <span className="truncate">{opt.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => removeChip(opt.value, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    removeChip(opt.value, e as unknown as React.MouseEvent);
                  }
                }}
                className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#1a2f6e]/20 cursor-pointer"
                aria-label={`Remove ${opt.label}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          ))}
        </div>
        <span className="shrink-0 self-center">
          <ChevronDownIcon open={open} />
        </span>
      </button>

      {/* Popover listbox — same rounded-2xl + shadow-lg as TimePicker. */}
      {open && (
        <div className="relative z-50">
          <div
            role="listbox"
            aria-multiselectable="true"
            className="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg p-2 min-w-[280px]"
          >
            {options.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(opt.value)}
                  className={[
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer',
                    isSelected ? 'bg-[#1a2f6e]/5' : 'hover:bg-gray-100',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0',
                      isSelected
                        ? 'bg-[#1a2f6e] border-[#1a2f6e]'
                        : 'bg-white border-gray-300',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isSelected && <CheckIcon />}
                  </span>
                  <span className={isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function TimePicker({ label, value, onChange, error }: TimePickerProps) {
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
          error
            ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-300'
            : open
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export const WarehouseLocationForm = forwardRef<
  WarehouseLocationFormHandle,
  WarehouseLocationFormProps
>(function WarehouseLocationForm(
  { initialData, saved = false, className = '' },
  ref,
) {
  const [formData, setFormData] = useState<WarehouseFormData>({
    ...INITIAL_FORM_STATE,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WarehouseFormData, string>>>({});

  // Author: samir
  // Impact: updateField now preserves the concrete per-field type
  // Reason: warehouseAddresses is a string[], the time fields are strings — one generic signature keeps both paths type-safe without a union cast
  const updateField = useCallback(
    <K extends keyof WarehouseFormData>(field: K, value: WarehouseFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  /**
   * Zod safeParse + surface field errors. Returns parsed data or null.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const runValidation = useCallback((): WarehouseLocationInput | null => {
    const result = warehouseLocationSchema.safeParse(formData);
    if (result.success) {
      setErrors({});
      return result.data;
    }

    const fieldErrors: Partial<Record<keyof WarehouseFormData, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof WarehouseFormData | undefined;
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return null;
  }, [formData]);

  useImperativeHandle(
    ref,
    () => ({
      validate: runValidation,
      getFormData: () => formData,
    }),
    [runValidation, formData],
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
        {/* Warehouse addresses — multi-select with 3 static options for now */}
        <WarehouseMultiSelect
          label="Warehouse address *"
          options={WAREHOUSE_OPTIONS}
          value={formData.warehouseAddresses}
          onChange={(next) => updateField('warehouseAddresses', next)}
          error={errors.warehouseAddresses}
        />

        {/* Author: samir */}
        {/* Impact: time picker grid breathes on ultra-wide screens via larger xl/2xl column gaps */}
        {/* Reason: layout is now full-width; prevents pickers from feeling stranded at opposite edges */}
        {/* Time fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
          <TimePicker
            label="Earliest start time"
            value={formData.earliestStartTime}
            onChange={(val) => updateField('earliestStartTime', val)}
            error={errors.earliestStartTime}
          />
          <TimePicker
            label="Latest return time"
            value={formData.latestReturnTime}
            onChange={(val) => updateField('latestReturnTime', val)}
            error={errors.latestReturnTime}
          />
        </div>
      </div>
    </Card>
  );
});
