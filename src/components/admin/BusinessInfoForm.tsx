'use client';

// Old Author: samir
// New Author: samir
// Impact: empty default state, Zod-backed validation, imperative validate/getFormData handle for parent coordination
// Reason: form previously trusted hardcoded dummy data and had no validation — the org-setup page needed real client validation and a way to trigger it from the parent Save & Continue button

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { Card } from '../ui/Card';
import Input from '../ui/Input';
import { Select } from '../ui/Select';
import {
  businessInfoSchema,
  type BusinessInfoInput,
} from '@/lib/validation/org-setup';

export interface BusinessFormData {
  businessName: string;
  tradingName: string;
  abn: string;
  gstRegistered: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  currency: string;
}

/**
 * Imperative handle exposed to the parent via ref. Lets the parent
 * trigger validation and read the current form values without lifting
 * state up to the page component.
 */
export interface BusinessInfoFormHandle {
  /** Runs Zod validation, surfaces field errors, returns parsed data or null. */
  validate: () => BusinessInfoInput | null;
  /** Returns raw form state without validating. */
  getFormData: () => BusinessFormData;
}

interface BusinessInfoFormProps {
  initialData?: Partial<BusinessFormData>;
  saved?: boolean;
  className?: string;
}

const GST_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST +08:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST +11:00)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST +11:00)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST +10:00)' },
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST +09:30)' },
];

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

// Sensible empty defaults — no sample data.
// Timezone/currency default to AU since this is the PerthBCH platform.
const INITIAL_FORM_STATE: BusinessFormData = {
  businessName: '',
  tradingName: '',
  abn: '',
  gstRegistered: 'no',
  email: '',
  phone: '',
  address: '',
  timezone: 'Australia/Perth',
  currency: 'AUD',
};

export const BusinessInfoForm = forwardRef<
  BusinessInfoFormHandle,
  BusinessInfoFormProps
>(function BusinessInfoForm(
  { initialData, saved = false, className = '' },
  ref,
) {
  const [formData, setFormData] = useState<BusinessFormData>({
    ...INITIAL_FORM_STATE,
    ...initialData,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof BusinessFormData, string>>
  >({});

  const updateField = useCallback(
    (field: keyof BusinessFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear the error as the user types so the message doesn't linger.
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
   * Runs Zod safeParse on the current state, maps any issues to field
   * errors, and returns the parsed data (transforms applied) or null.
   *
   * @returns Parsed business info on success, null when validation fails.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const runValidation = useCallback((): BusinessInfoInput | null => {
    const result = businessInfoSchema.safeParse(formData);
    if (result.success) {
      setErrors({});
      return result.data;
    }

    const fieldErrors: Partial<Record<keyof BusinessFormData, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof BusinessFormData | undefined;
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
        <h2 className="text-base font-semibold text-slate-900">Business Information</h2>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.3 4.3L6 11.6L2.7 8.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Author: samir */}
      {/* Impact: form grid breathes on ultra-wide screens via larger xl/2xl column gaps */}
      {/* Reason: layout is now full-width; without extra gap, 2-col fields stretch uncomfortably on 2xl+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
        {/* Row 1: Business name + Trading name */}
        <Input
          label="Business name *"
          value={formData.businessName}
          onChange={(e) => updateField('businessName', e.target.value)}
          placeholder="e.g. Perthbouncycastlehire"
          error={errors.businessName}
        />
        <Input
          label="Trading name"
          value={formData.tradingName}
          onChange={(e) => updateField('tradingName', e.target.value)}
          placeholder="e.g. PerthBCH"
          error={errors.tradingName}
        />

        {/* Row 2: ABN + GST registered */}
        <Input
          label="ABN"
          value={formData.abn}
          onChange={(e) => updateField('abn', e.target.value)}
          placeholder="11-digit ABN"
          error={errors.abn}
          inputMode="numeric"
        />
        <Select
          label="GST registered"
          options={GST_OPTIONS}
          value={formData.gstRegistered}
          onChange={(val) => updateField('gstRegistered', val)}
          error={errors.gstRegistered}
        />

        {/* Row 3: Business email + Business phone */}
        <Input
          label="Business email *"
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="hello@yourbusiness.com.au"
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Business phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder="08 9XXX XXXX"
          error={errors.phone}
          autoComplete="tel"
        />

        {/* Row 4: Business address (full width) */}
        <div className="md:col-span-2">
          <Input
            label="Business address *"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Street, suburb, state"
            error={errors.address}
            autoComplete="street-address"
          />
        </div>

        {/* Row 5: Timezone + Currency */}
        <Select
          label="Timezone *"
          options={TIMEZONE_OPTIONS}
          value={formData.timezone}
          onChange={(val) => updateField('timezone', val)}
          error={errors.timezone}
        />
        <Select
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={formData.currency}
          onChange={(val) => updateField('currency', val)}
          error={errors.currency}
        />
      </div>
    </Card>
  );
});
