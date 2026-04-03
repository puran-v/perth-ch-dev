'use client';

import { TopBar } from '@/components/ui/TopBar';
import { SetupProgressCard } from '@/components/admin/SetupProgressCard';
import { BusinessInfoForm } from '@/components/admin/BusinessInfoForm';
import { WarehouseLocationForm } from '@/components/admin/WarehouseLocationForm';
import { PaymentInvoiceForm } from '@/components/admin/PaymentInvoiceForm';
import Button from '@/components/ui/Button';
import type { StepperStep } from '@/components/ui/SetupStepper';

// --- Setup steps data ---
const SETUP_STEPS: StepperStep[] = [
  { id: 'org-info', label: 'Org Info', status: 'completed', stepNumber: 1 },
  { id: 'branding', label: 'Branding', status: 'completed', stepNumber: 2 },
  { id: 'team', label: 'Team', status: 'current', stepNumber: 3 },
  { id: 'products', label: 'Products', status: 'pending', stepNumber: 4 },
  { id: 'bundles', label: 'Bundles', status: 'pending', stepNumber: 5 },
  { id: 'rules', label: 'Rules', status: 'pending', stepNumber: 6 },
];

const INITIAL_BUSINESS_DATA = {
  businessName: 'Perthbouncycastlehire',
  tradingName: 'PerthBCH',
  abn: '123 145 563',
  gstRegistered: 'no',
  email: 'hello@perthbch.com.au',
  phone: '08 9XXX XXXX',
  address: 'Perth, Western Australia',
  timezone: 'Australia/Perth',
  currency: 'AUD',
};

const INITIAL_WAREHOUSE_DATA = {
  warehouseAddress: 'Perth, Western Australia',
  earliestStartTime: '06:00',
  latestReturnTime: '20:00',
};

const INITIAL_PAYMENT_DATA = {
  defaultPaymentTerms: 'net-7',
  invoiceNumberPrefix: 'INV-',
  invoiceStartingNumber: '1001',
  defaultDepositPercent: '30',
  bankName: '',
  bsb: '000 000',
  accountNumber: '',
  accountName: '',
  autoApplyCreditCardSurcharge: true,
  surchargePercent: '1.5',
  labelOnInvoice: 'Credit Card Processing Fee',
};

export default function OrgSetupPage() {
  const handleSaveDraft = () => {
    console.log('Saving draft...');
  };

  const handleSaveAndContinue = () => {
    console.log('Saving and continuing...');
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
        completedCount={2}
        totalCount={6}
        steps={SETUP_STEPS}
      />

      {/* Business Information */}
      <BusinessInfoForm initialData={INITIAL_BUSINESS_DATA} saved />

      {/* Warehouse Location */}
      <WarehouseLocationForm initialData={INITIAL_WAREHOUSE_DATA} saved />

      {/* Payment & Invoice Settings */}
      <PaymentInvoiceForm initialData={INITIAL_PAYMENT_DATA} />

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
