'use client';

// Old Author: samir
// New Author: samir
// Impact: added forwardRef handle + Zod validation including conditional surcharge rules
// Reason: payment form needed real validation wired into the org-setup Save & Continue flow

import {
  forwardRef,
  useState,
  useCallback,
  useImperativeHandle,
} from 'react';
import { Card } from '../ui/Card';
import Input from '../ui/Input';
import { Select } from '../ui/Select';
import {
  paymentInvoiceSchema,
  type PaymentInvoiceInput,
} from '@/lib/validation/org-setup';

export interface PaymentFormData {
  defaultPaymentTerms: string;
  invoiceNumberPrefix: string;
  invoiceStartingNumber: string;
  defaultDepositPercent: string;
  bankName: string;
  bsb: string;
  accountNumber: string;
  accountName: string;
  autoApplyCreditCardSurcharge: boolean;
  surchargePercent: string;
  labelOnInvoice: string;
}

/** Imperative handle exposed to the parent via ref. */
export interface PaymentInvoiceFormHandle {
  validate: () => PaymentInvoiceInput | null;
  getFormData: () => PaymentFormData;
}

interface PaymentInvoiceFormProps {
  initialData?: Partial<PaymentFormData>;
  saved?: boolean;
  className?: string;
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'net-7', label: 'Net 7 days' },
  { value: 'net-14', label: 'Net 14 days' },
  { value: 'net-30', label: 'Net 30 days' },
  { value: 'due-on-receipt', label: 'Due on receipt' },
  { value: 'before-event', label: 'Before event' },
];

const INITIAL_FORM_STATE: PaymentFormData = {
  defaultPaymentTerms: 'net-7',
  invoiceNumberPrefix: 'INV-',
  invoiceStartingNumber: '1001',
  defaultDepositPercent: '30',
  bankName: '',
  bsb: '',
  accountNumber: '',
  accountName: '',
  autoApplyCreditCardSurcharge: true,
  surchargePercent: '1.5',
  labelOnInvoice: 'Credit Card Processing Fee',
};

export const PaymentInvoiceForm = forwardRef<
  PaymentInvoiceFormHandle,
  PaymentInvoiceFormProps
>(function PaymentInvoiceForm(
  { initialData, saved = false, className = '' },
  ref,
) {
  const [formData, setFormData] = useState<PaymentFormData>({
    ...INITIAL_FORM_STATE,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentFormData, string>>>({});

  const updateField = useCallback(
    (field: keyof PaymentFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const key = field as keyof PaymentFormData;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  /**
   * Zod safeParse + surface field errors. Returns parsed data or null.
   * The schema applies superRefine to conditionally require surcharge
   * fields when autoApplyCreditCardSurcharge is true.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const runValidation = useCallback((): PaymentInvoiceInput | null => {
    const result = paymentInvoiceSchema.safeParse(formData);
    if (result.success) {
      setErrors({});
      return result.data;
    }

    const fieldErrors: Partial<Record<keyof PaymentFormData, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof PaymentFormData | undefined;
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
        <h2 className="text-base font-semibold text-slate-900">Payment & Invoice Settings</h2>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.3 4.3L6 11.6L2.7 8.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </span>
        )}
      </div>

      <div className="space-y-5">
        {/* Row 1: Payment terms + Invoice prefix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
          <Select
            label="Default payment terms *"
            options={PAYMENT_TERMS_OPTIONS}
            value={formData.defaultPaymentTerms}
            onChange={(val) => updateField('defaultPaymentTerms', val)}
            error={errors.defaultPaymentTerms}
          />
          <Input
            label="Invoice number prefix *"
            value={formData.invoiceNumberPrefix}
            onChange={(e) => updateField('invoiceNumberPrefix', e.target.value)}
            placeholder="INV-"
            error={errors.invoiceNumberPrefix}
          />
        </div>

        {/* Row 2: Invoice starting number + Default deposit % */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
          <Input
            label="Invoice starting number *"
            value={formData.invoiceStartingNumber}
            onChange={(e) => updateField('invoiceStartingNumber', e.target.value)}
            placeholder="1001"
            error={errors.invoiceStartingNumber}
            inputMode="numeric"
          />
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-gray-700">Default deposit % *</label>
            <div
              className={[
                'flex items-center gap-2 rounded-full border bg-white px-4 h-12 transition-colors',
                errors.defaultDepositPercent
                  ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-300'
                  : 'border-gray-200 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20',
              ].join(' ')}
            >
              <input
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                value={formData.defaultDepositPercent}
                onChange={(e) => updateField('defaultDepositPercent', e.target.value)}
                placeholder="30"
                inputMode="decimal"
                aria-invalid={errors.defaultDepositPercent ? true : undefined}
              />
              <span className="text-sm text-gray-500 font-medium shrink-0">%</span>
            </div>
            {errors.defaultDepositPercent && (
              <p className="text-xs text-red-500">{errors.defaultDepositPercent}</p>
            )}
          </div>
        </div>

        {/* Row 3: Bank name + BSB */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
          <Input
            label="Bank name"
            value={formData.bankName}
            onChange={(e) => updateField('bankName', e.target.value)}
            placeholder="Enter"
            error={errors.bankName}
          />
          <Input
            label="BSB"
            value={formData.bsb}
            onChange={(e) => updateField('bsb', e.target.value)}
            placeholder="000 000"
            error={errors.bsb}
          />
        </div>

        {/* Row 4: Account number + Account name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
          <Input
            label="Account number"
            value={formData.accountNumber}
            onChange={(e) => updateField('accountNumber', e.target.value)}
            placeholder="Enter"
            error={errors.accountNumber}
          />
          <Input
            label="Account name"
            value={formData.accountName}
            onChange={(e) => updateField('accountName', e.target.value)}
            placeholder="Enter"
            error={errors.accountName}
          />
        </div>

        {/* Credit card surcharge divider */}
        <div className="pt-2">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-slate-900">Credit card surcharge</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        </div>

        {/* Author: samir */}
        {/* Impact: toggle row wraps text and switch on small screens */}
        {/* Reason: long label text pushed toggle off-screen on 320px */}
        {/* Toggle row */}
        <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">Auto-apply credit card surcharge</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Adds a surcharge line item when customer pays by card. Label is customisable.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.autoApplyCreditCardSurcharge}
            onClick={() =>
              updateField('autoApplyCreditCardSurcharge', !formData.autoApplyCreditCardSurcharge)
            }
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/50',
              formData.autoApplyCreditCardSurcharge ? 'bg-[#1a2f6e]' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                formData.autoApplyCreditCardSurcharge ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Surcharge fields (visible when toggle is on) */}
        {formData.autoApplyCreditCardSurcharge && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-sm font-medium text-gray-700">Surcharge % *</label>
              <div
                className={[
                  'flex items-center gap-2 rounded-full border bg-white px-4 h-12 transition-colors',
                  errors.surchargePercent
                    ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-300'
                    : 'border-gray-200 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20',
                ].join(' ')}
              >
                <input
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                  value={formData.surchargePercent}
                  onChange={(e) => updateField('surchargePercent', e.target.value)}
                  placeholder="1.5"
                  inputMode="decimal"
                  aria-invalid={errors.surchargePercent ? true : undefined}
                />
                <span className="text-sm text-gray-500 font-medium shrink-0">%</span>
              </div>
              {errors.surchargePercent && (
                <p className="text-xs text-red-500">{errors.surchargePercent}</p>
              )}
            </div>
            <Input
              label="Label on invoice *"
              value={formData.labelOnInvoice}
              onChange={(e) => updateField('labelOnInvoice', e.target.value)}
              placeholder="Credit Card Processing Fee"
              error={errors.labelOnInvoice}
            />
          </div>
        )}
      </div>
    </Card>
  );
});
