'use client';

import { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import Input from '../ui/Input';
import { Select } from '../ui/Select';

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

interface BusinessInfoFormProps {
  initialData?: Partial<BusinessFormData>;
  onSave?: (data: BusinessFormData) => void;
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

export function BusinessInfoForm({
  initialData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSave,
  saved = false,
  className = '',
}: BusinessInfoFormProps) {
  const [formData, setFormData] = useState<BusinessFormData>({
    ...INITIAL_FORM_STATE,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormData, string>>>({});

  const updateField = useCallback(
    (field: keyof BusinessFormData, value: string) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {/* Row 1: Business name + Trading name */}
        <Input
          label="Business name *"
          value={formData.businessName}
          onChange={(e) => updateField('businessName', e.target.value)}
          placeholder="Perthbouncycastlehire"
          error={errors.businessName}
        />
        <Input
          label="Trading name"
          value={formData.tradingName}
          onChange={(e) => updateField('tradingName', e.target.value)}
          placeholder="PerthBCH"
        />

        {/* Row 2: ABN + GST registered */}
        <Input
          label="ABN"
          value={formData.abn}
          onChange={(e) => updateField('abn', e.target.value)}
          placeholder="123 145 563"
          error={errors.abn}
        />
        <Select
          label="GST registered"
          options={GST_OPTIONS}
          value={formData.gstRegistered}
          onChange={(val) => updateField('gstRegistered', val)}
        />

        {/* Row 3: Business email + Business phone */}
        <Input
          label="Business email *"
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="hello@perthbch.com.au"
          error={errors.email}
        />
        <Input
          label="Business phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder="08 9XXX XXXX"
        />

        {/* Row 4: Business address (full width) */}
        <div className="md:col-span-2">
          <Input
            label="Business address*"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Perth, Western Australia"
            error={errors.address}
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
        />
      </div>
    </Card>
  );
}
