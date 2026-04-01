'use client';

import { TopBar } from '@/components/ui/TopBar';
import { SetupProgressCard } from '@/components/admin/SetupProgressCard';
import { BusinessInfoForm, type BusinessFormData } from '@/components/admin/BusinessInfoForm';
import type { StepperStep } from '@/components/ui/SetupStepper';

// --- Setup steps data ---
const SETUP_STEPS: StepperStep[] = [
  { id: 'org-info', label: 'Org Info', status: 'completed', stepNumber: 1 },
  { id: 'branding', label: 'Branding', status: 'completed', stepNumber: 2 },
  { id: 'team', label: 'Team', status: 'current', stepNumber: 3 },
  { id: 'products', label: 'Products', status: 'pending', stepNumber: 4 },
  { id: 'bundles', label: 'Bundles', status: 'pending', stepNumber: 5 },
  { id: 'pricing', label: 'Pricing Rules', status: 'pending', stepNumber: 6 },
];

const INITIAL_BUSINESS_DATA = {
  businessName: 'Perth bouncy castle hire',
  abn: '',
  email: '',
  phone: '',
  address: '',
  suburb: '',
  state: 'WA',
  postcode: '',
  country: 'AU',
  timezone: 'Australia/Perth',
};

export default function AdminDashboardPage() {
  const handleSave = (data: BusinessFormData) => {
    console.log('Saving business info:', data);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <TopBar
        title="Org Setup"
        subtitle="Your business details, used across the entire application."
        notifications={2}
      />

      {/* Setup Progress */}
      <SetupProgressCard
        title="Module A: Setup progress"
        completedCount={2}
        totalCount={6}
        steps={SETUP_STEPS}
      />

      {/* Business Information Form */}
      <BusinessInfoForm
        initialData={INITIAL_BUSINESS_DATA}
        onSave={handleSave}
      />
    </div>
  );
}
