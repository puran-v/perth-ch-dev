'use client';

// Old Author: samir
// New Author: samir
// Impact: page now fetches saved setup from GET /api/org-setup and persists through PUT /api/org-setup via React Query; both Save Draft and Save & Continue round-trip through the backend
// Reason: previously the buttons only console.log'd — Module A progress needs to persist across sessions per PROJECT_RULES.md §9.1 (React Query for all server state)

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { TopBar } from '@/components/ui/TopBar';
import { SetupProgressCard } from '@/components/admin/SetupProgressCard';
import {
  BusinessInfoForm,
  type BusinessFormData,
  type BusinessInfoFormHandle,
} from '@/components/admin/BusinessInfoForm';
import {
  WarehouseLocationForm,
  type WarehouseFormData,
  type WarehouseLocationFormHandle,
} from '@/components/admin/WarehouseLocationForm';
import {
  PaymentInvoiceForm,
  type PaymentFormData,
  type PaymentInvoiceFormHandle,
} from '@/components/admin/PaymentInvoiceForm';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StepperStep } from '@/components/ui/SetupStepper';
import { useApiQuery, useApiMutation } from '@/hooks';
import { ApiError } from '@/lib/api-client';
import type {
  BusinessInfoInput,
  WarehouseLocationInput,
  PaymentInvoiceInput,
} from '@/lib/validation/org-setup';
// Author: samir
// Impact: page reuses the exported OrgSetupResponse type from the API route
// Reason: single source of truth for the response shape means the page and route can't drift apart
import type { OrgSetupResponse } from '@/app/api/org-setup/route';

/** Body accepted by PUT /api/org-setup — must match orgSetupSaveSchema. */
type SaveOrgSetupPayload =
  | {
      mode: 'draft';
      business?: Partial<BusinessFormData>;
      warehouse?: Partial<WarehouseFormData>;
      payment?: Partial<PaymentFormData>;
    }
  | {
      mode: 'complete';
      business: BusinessInfoInput;
      warehouse: WarehouseLocationInput;
      payment: PaymentInvoiceInput;
    };

const ORG_SETUP_QUERY_KEY = ['org-setup'] as const;
const NEXT_STEP_HREF = '/dashboard/branding';

// ---------------------------------------------------------------------------
// Stepper helper
// ---------------------------------------------------------------------------

/**
 * Builds the stepper steps for the Module A progress card. The first
 * step's status reflects whether the user has already completed org
 * setup; everything after it is rendered as pending for now (those
 * modules aren't wired up yet).
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
function buildSetupSteps(isComplete: boolean): StepperStep[] {
  return [
    {
      id: 'org-info',
      label: 'Org Info',
      status: isComplete ? 'completed' : 'current',
      stepNumber: 1,
      href: '/dashboard/org-setup',
    },
    {
      id: 'branding',
      label: 'Branding',
      status: isComplete ? 'current' : 'pending',
      stepNumber: 2,
      href: '/dashboard/branding',
    },
    { id: 'team', label: 'Team', status: 'pending', stepNumber: 3, href: '/dashboard/team' },
    { id: 'products', label: 'Products', status: 'pending', stepNumber: 4, href: '/dashboard/products' },
    { id: 'bundles', label: 'Bundles', status: 'pending', stepNumber: 5, href: '/dashboard/bundles' },
    { id: 'rules', label: 'Rules', status: 'pending', stepNumber: 6, href: '/dashboard/pricing' },
  ];
}

// ---------------------------------------------------------------------------
// Loading skeleton — shown while the initial GET is in flight
// ---------------------------------------------------------------------------

/**
 * Lightweight skeleton that preserves the layout shape while the
 * initial org setup query is loading. Avoids rendering the real forms
 * with empty values and then flashing them to the server data.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
function OrgSetupSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-live="polite">
      <Card>
        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-2 w-full bg-slate-100 rounded mt-4 animate-pulse" />
        <div className="flex gap-4 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
          ))}
        </div>
      </Card>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-12 w-full bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function OrgSetupPage() {
  const router = useRouter();
  const businessRef = useRef<BusinessInfoFormHandle>(null);
  const warehouseRef = useRef<WarehouseLocationFormHandle>(null);
  const paymentRef = useRef<PaymentInvoiceFormHandle>(null);

  // Load any previously saved setup so the forms can hydrate with it.
  // `data` is `null` when the user has no org yet or hasn't saved before.
  const {
    data,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useApiQuery<OrgSetupResponse | null>(
    ORG_SETUP_QUERY_KEY,
    '/api/org-setup',
  );

  // Author: samir
  // Impact: single mutation handles both Save Draft and Save & Continue
  // Reason: the API accepts mode=draft|complete so we only need one hook; the onSuccess branching happens in the handler so each button can show its own toast + navigation
  const saveMutation = useApiMutation<OrgSetupResponse, SaveOrgSetupPayload>(
    '/api/org-setup',
    'put',
    { invalidateKeys: [ORG_SETUP_QUERY_KEY] },
  );

  const isSaving = saveMutation.isPending;

  // Only render forms once the initial load has resolved. This avoids
  // the "flash of empty form" race when initialData arrives late — the
  // forms capture initialData into local state on mount and never re-read
  // it, so the parent must gate rendering on the query result.
  const setupSteps = useMemo(
    () => buildSetupSteps(data?.status === 'COMPLETE'),
    [data?.status],
  );

  /**
   * Collects current values from every mounted form. Safe to call during
   * loading/error states — refs will simply be null and the result will
   * be an empty object with no sections.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const collectFormData = (): {
    business?: Partial<BusinessFormData>;
    warehouse?: Partial<WarehouseFormData>;
    payment?: Partial<PaymentFormData>;
  } => ({
    business: businessRef.current?.getFormData(),
    warehouse: warehouseRef.current?.getFormData(),
    payment: paymentRef.current?.getFormData(),
  });

  /**
   * Maps an ApiError from the backend into a user-facing toast. Surfaces
   * VALIDATION_ERROR details when the server reports specific field
   * issues, otherwise falls back to the generic message.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const handleMutationError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      const first = err.details[0] as { field?: string; message?: string } | undefined;
      const detailMsg = first?.message ?? err.message;
      toast.error(`Server rejected the save: ${detailMsg}`);
      return;
    }
    if (err instanceof ApiError) {
      toast.error(err.message);
      return;
    }
    toast.error('Something went wrong while saving. Please try again.');
  };

  /**
   * Save Draft — sends whatever is in the forms right now without
   * client-side validation, so partial work is preserved.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const handleSaveDraft = () => {
    if (isSaving) return;
    const { business, warehouse, payment } = collectFormData();

    saveMutation.mutate(
      { mode: 'draft', business, warehouse, payment },
      {
        onSuccess: () => {
          toast.success('Draft saved.');
        },
        onError: handleMutationError,
      },
    );
  };

  /**
   * Save & Continue — runs strict Zod validation locally first (same
   * schema as the server), reports failing sections to the user, and
   * only hits the API when every form is valid. On success, navigates
   * to the next stepper page.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Org Setup
   */
  const handleSaveAndContinue = () => {
    if (isSaving) return;

    const business = businessRef.current?.validate();
    const warehouse = warehouseRef.current?.validate();
    const payment = paymentRef.current?.validate();

    const failed: string[] = [];
    if (!business) failed.push('Business Information');
    if (!warehouse) failed.push('Warehouse Location');
    if (!payment) failed.push('Payment & Invoice Settings');

    if (failed.length > 0) {
      toast.error(`Please fix the highlighted fields in: ${failed.join(', ')}`);
      return;
    }

    // Type narrowing: all three are non-null at this point.
    saveMutation.mutate(
      {
        mode: 'complete',
        business: business!,
        warehouse: warehouse!,
        payment: payment!,
      },
      {
        onSuccess: () => {
          toast.success('Org setup saved. Continuing to next step.');
          router.push(NEXT_STEP_HREF);
        },
        onError: handleMutationError,
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <TopBar
          title="Org Setup"
          subtitle="Your business details used across quotes, invoices, and all customer-facing communications."
          notifications={2}
          showDateBar
        />
        <OrgSetupSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <TopBar
          title="Org Setup"
          subtitle="Your business details used across quotes, invoices, and all customer-facing communications."
          notifications={2}
          showDateBar
        />
        <Card>
          <div className="text-center py-6">
            <p className="text-sm text-slate-700 font-medium">Couldn&apos;t load your org setup.</p>
            <p className="text-xs text-slate-500 mt-1">
              {queryError instanceof ApiError ? queryError.message : 'Please try again.'}
            </p>
            <div className="mt-4">
              <Button variant="outline" size="md" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Defensive fallback for the JSON columns — the API returns `null` for
  // sections that were never saved. Cast to Partial for safety since the
  // DB could in theory contain older shapes.
  const initialBusiness = (data?.business ?? undefined) as Partial<BusinessFormData> | undefined;
  const initialWarehouse = (data?.warehouse ?? undefined) as Partial<WarehouseFormData> | undefined;
  const initialPayment = (data?.payment ?? undefined) as Partial<PaymentFormData> | undefined;

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
        completedCount={data?.status === 'COMPLETE' ? 1 : 0}
        totalCount={6}
        steps={setupSteps}
      />

      {/* Business Information */}
      <BusinessInfoForm
        ref={businessRef}
        initialData={initialBusiness}
        saved={data?.status === 'COMPLETE'}
      />

      {/* Warehouse Location */}
      <WarehouseLocationForm
        ref={warehouseRef}
        initialData={initialWarehouse}
        saved={data?.status === 'COMPLETE'}
      />

      {/* Payment & Invoice Settings */}
      <PaymentInvoiceForm
        ref={paymentRef}
        initialData={initialPayment}
        saved={data?.status === 'COMPLETE'}
      />

      {/* Author: samir */}
      {/* Impact: buttons stack vertically on mobile, row on sm+; disabled while mutation is in flight */}
      {/* Reason: two large buttons side-by-side overflowed on 320px screens and users could double-submit */}
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button
          variant="outline"
          size="lg"
          onClick={handleSaveDraft}
          loading={isSaving && saveMutation.variables?.mode === 'draft'}
          disabled={isSaving && saveMutation.variables?.mode !== 'draft'}
        >
          Save Draft
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSaveAndContinue}
          loading={isSaving && saveMutation.variables?.mode === 'complete'}
          disabled={isSaving && saveMutation.variables?.mode !== 'complete'}
        >
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
