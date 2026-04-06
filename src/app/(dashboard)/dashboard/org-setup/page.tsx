'use client';

// Old Author: samir
// New Author: samir
// Impact: removed hardcoded sample data, wired refs + Zod validation into Save & Continue
// Reason: the page previously rendered with PerthBCH sample data prefilled into every input and never validated on submit. Inputs now start empty (real data will come from the org-setup API once available), and Save & Continue validates all three forms before proceeding.

import { useRef } from 'react';
import { toast } from 'react-toastify';
import { TopBar } from '@/components/ui/TopBar';
import { SetupProgressCard } from '@/components/admin/SetupProgressCard';
import {
  BusinessInfoForm,
  type BusinessInfoFormHandle,
} from '@/components/admin/BusinessInfoForm';
import {
  WarehouseLocationForm,
  type WarehouseLocationFormHandle,
} from '@/components/admin/WarehouseLocationForm';
import {
  PaymentInvoiceForm,
  type PaymentInvoiceFormHandle,
} from '@/components/admin/PaymentInvoiceForm';
import Button from '@/components/ui/Button';
import type { StepperStep } from '@/components/ui/SetupStepper';

// Author: samir
// Impact: each setup step now carries an href so clicking the circle navigates to that page
// Reason: stepper was purely visual before; users should be able to jump between setup modules directly
// --- Setup steps data ---
const SETUP_STEPS: StepperStep[] = [
  { id: 'org-info', label: 'Org Info', status: 'current', stepNumber: 1, href: '/dashboard/org-setup' },
  { id: 'branding', label: 'Branding', status: 'pending', stepNumber: 2, href: '/dashboard/branding' },
  { id: 'team', label: 'Team', status: 'pending', stepNumber: 3, href: '/dashboard/team' },
  { id: 'products', label: 'Products', status: 'pending', stepNumber: 4, href: '/dashboard/products' },
  { id: 'bundles', label: 'Bundles', status: 'pending', stepNumber: 5, href: '/dashboard/bundles' },
  { id: 'rules', label: 'Rules', status: 'pending', stepNumber: 6, href: '/dashboard/pricing' },
];

export default function OrgSetupPage() {
  const businessRef = useRef<BusinessInfoFormHandle>(null);
  const warehouseRef = useRef<WarehouseLocationFormHandle>(null);
  const paymentRef = useRef<PaymentInvoiceFormHandle>(null);

  /**
   * Captures current values from every form without running validation.
   * Used for "Save Draft" so partially-filled forms can be persisted.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const handleSaveDraft = () => {
    const draft = {
      business: businessRef.current?.getFormData(),
      warehouse: warehouseRef.current?.getFormData(),
      payment: paymentRef.current?.getFormData(),
    };
    // TODO: wire to POST /api/org-setup?mode=draft once the endpoint exists
    console.log('[org-setup] save draft', draft);
    toast.info('Draft saved locally. Backend sync pending.');
  };

  /**
   * Validates every form in order, surfaces the first failing section to
   * the user, and only proceeds when all three pass. The full parsed
   * payload is handed off to the (future) save API.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const handleSaveAndContinue = () => {
    const business = businessRef.current?.validate();
    const warehouse = warehouseRef.current?.validate();
    const payment = paymentRef.current?.validate();

    // Collect the section labels that failed so we can tell the user
    // which cards to look at instead of a generic "please fix errors".
    const failed: string[] = [];
    if (!business) failed.push('Business Information');
    if (!warehouse) failed.push('Warehouse Location');
    if (!payment) failed.push('Payment & Invoice Settings');

    if (failed.length > 0) {
      toast.error(`Please fix the highlighted fields in: ${failed.join(', ')}`);
      return;
    }

    const payload = { business, warehouse, payment };
    // TODO: wire to POST /api/org-setup once the endpoint exists
    console.log('[org-setup] save & continue', payload);
    toast.success('Org setup saved. Continuing to next step...');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Bar */}
      <TopBar
        title="Org Setup"
        subtitle="Your business details used across quotes, invoices, and all customer-facing communications."
        notifications={2}
        showDateBar
      />

      {/* Setup Progress */}
      <SetupProgressCard
        title="Module A setup progress"
        completedCount={0}
        totalCount={6}
        steps={SETUP_STEPS}
      />

      {/* Business Information */}
      <BusinessInfoForm ref={businessRef} />

      {/* Warehouse Location */}
      <WarehouseLocationForm ref={warehouseRef} />

      {/* Payment & Invoice Settings */}
      <PaymentInvoiceForm ref={paymentRef} />

      {/* Author: samir */}
      {/* Impact: buttons stack vertically on mobile, row on sm+ */}
      {/* Reason: two large buttons side-by-side overflowed on 320px screens */}
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button variant="outline" size="lg" onClick={handleSaveDraft}>
          Save Draft
        </Button>
        <Button variant="primary" size="lg" onClick={handleSaveAndContinue}>
          <span className="flex items-center justify-center gap-2">
            Save & Continue
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Button>
      </div>
    </div>
  );
}
