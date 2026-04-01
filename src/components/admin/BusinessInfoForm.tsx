'use client';

import React, { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import Input from '../ui/Input';
import { Select } from '../ui/Select';
import Button from '../ui/Button';

export interface BusinessFormData {
  businessName: string;
  abn: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  timezone: string;
}

interface BusinessInfoFormProps {
  initialData?: Partial<BusinessFormData>;
  onSave?: (data: BusinessFormData) => void;
  isLoading?: boolean;
  stateOptions?: { value: string; label: string }[];
  countryOptions?: { value: string; label: string }[];
  timezoneOptions?: { value: string; label: string }[];
  className?: string;
}

const DEFAULT_STATE_OPTIONS = [
  { value: 'WA', label: 'Western Australia' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
];

const DEFAULT_COUNTRY_OPTIONS = [
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
];

const DEFAULT_TIMEZONE_OPTIONS = [
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST)' },
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST)' },
];

const INITIAL_FORM_STATE: BusinessFormData = {
  businessName: '',
  abn: '',
  email: '',
  phone: '',
  address: '',
  suburb: '',
  state: '',
  postcode: '',
  country: '',
  timezone: '',
};

export function BusinessInfoForm({
  initialData,
  onSave,
  isLoading = false,
  stateOptions = DEFAULT_STATE_OPTIONS,
  countryOptions = DEFAULT_COUNTRY_OPTIONS,
  timezoneOptions = DEFAULT_TIMEZONE_OPTIONS,
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

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof BusinessFormData, string>> = {};
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.abn.trim()) newErrors.abn = 'ABN is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.suburb.trim()) newErrors.suburb = 'Suburb is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.postcode.trim()) newErrors.postcode = 'Postcode is required';
    if (!formData.country) newErrors.country = 'Country is required';
    if (!formData.timezone) newErrors.timezone = 'Timezone is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (validate()) {
        onSave?.(formData);
      }
    },
    [formData, validate, onSave],
  );

  return (
    <Card className={className}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Business Information</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your business details used across the entire application.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Row 1 */}
          <Input
            label="Business Name *"
            value={formData.businessName}
            onChange={(e) => updateField('businessName', e.target.value)}
            placeholder="Perth bouncy castle hire"
            error={errors.businessName}
          />
          <Input
            label="ABN *"
            value={formData.abn}
            onChange={(e) => updateField('abn', e.target.value)}
            placeholder="12 345 678 901"
            error={errors.abn}
          />

          {/* Row 2 */}
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="info@perthbouncy.com.au"
            error={errors.email}
          />
          <Input
            label="Phone *"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+61 4XX XXX XXX"
            error={errors.phone}
          />

          {/* Row 3 */}
          <Input
            label="Address *"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="123 Main Street"
            error={errors.address}
          />
          <Input
            label="Suburb *"
            value={formData.suburb}
            onChange={(e) => updateField('suburb', e.target.value)}
            placeholder="Perth"
            error={errors.suburb}
          />

          {/* Row 4 */}
          <Select
            label="State"
            options={stateOptions}
            value={formData.state}
            onChange={(val) => updateField('state', val)}
            placeholder="Select state"
            error={errors.state}
            required
          />
          <Input
            label="Postcode *"
            value={formData.postcode}
            onChange={(e) => updateField('postcode', e.target.value)}
            placeholder="6000"
            error={errors.postcode}
          />

          {/* Row 5 */}
          <Select
            label="Country"
            options={countryOptions}
            value={formData.country}
            onChange={(val) => updateField('country', val)}
            placeholder="Select country"
            error={errors.country}
            required
          />
          <Select
            label="Timezone"
            options={timezoneOptions}
            value={formData.timezone}
            onChange={(val) => updateField('timezone', val)}
            placeholder="Select timezone"
            error={errors.timezone}
            required
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-8 pt-6 border-t border-slate-200">
          <Button type="submit" loading={isLoading}>
            Save Draft
          </Button>
        </div>
      </form>
    </Card>
  );
}
