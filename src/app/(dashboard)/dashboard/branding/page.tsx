'use client';

// Old Author: (scaffold)
// New Author: samir
// Impact: full implementation of Module A step 2 — Branding — wired to the shared /api/org-setup endpoint
// Reason: the stepper circle linked here but the page was a stub. Fresh signup users need to reach this screen, fill in logo + brand colours + email sender identity, and advance to the Products step.

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  BrandingForm,
  type BrandingFormData,
  type BrandingFormHandle,
} from '@/components/admin/BrandingForm';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StepperStep } from '@/components/ui/SetupStepper';
import { useApiQuery, useApiMutation } from '@/hooks';
import { ApiError } from '@/lib/api-client';
import {
  brandingSchema,
  businessInfoSchema,
  warehouseLocationSchema,
  paymentInvoiceSchema,
  type BrandingInput,
} from '@/lib/validation/org-setup';
import type { OrgSetupResponse } from '@/app/api/org-setup/route';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Body accepted by PUT /api/org-setup for the branding section. */
type SaveBrandingPayload =
  | {
      mode: 'draft';
      branding?: Partial<BrandingFormData>;
    }
  | {
      mode: 'complete';
      branding: BrandingInput;
    };

// Author: samir
// Impact: branding page shares the same React Query key as org-setup so cache invalidation flows through
// Reason: both pages read the same OrgSetup row — invalidating a single key keeps them in sync without hand-wiring cross-page refetches
const ORG_SETUP_QUERY_KEY = ['org-setup'] as const;
const NEXT_STEP_HREF = '/dashboard/products';

// ---------------------------------------------------------------------------
// Stepper helper
// ---------------------------------------------------------------------------

/**
 * Builds the stepper steps with Branding as the active step. Org Info
 * is always rendered as completed on this page (the user had to save
 * org-setup first to reach branding in the normal flow, but even if
 * they jumped here directly the branding save will bring the whole
 * setup forward anyway).
 *
 * @param brandingComplete - Whether branding has already been saved with a full payload
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Branding
 */
function buildSetupSteps(
  orgInfoComplete: boolean,
  brandingComplete: boolean,
): StepperStep[] {
  return [
    {
      id: 'org-info',
      label: 'Org Info',
      status: orgInfoComplete ? 'completed' : 'pending',
      stepNumber: 1,
      href: '/dashboard/org-setup',
    },
    {
      id: 'branding',
      label: 'Branding',
      status: brandingComplete ? 'completed' : 'current',
      stepNumber: 2,
      href: '/dashboard/branding',
    },
    {
      id: 'team',
      label: 'Team',
      status: brandingComplete ? 'current' : 'pending',
      stepNumber: 3,
      href: '/dashboard/team',
    },
    { id: 'products', label: 'Products', status: 'pending', stepNumber: 4, href: '/dashboard/products' },
    { id: 'bundles', label: 'Bundles', status: 'pending', stepNumber: 5, href: '/dashboard/bundles' },
    { id: 'rules', label: 'Rules', status: 'pending', stepNumber: 6, href: '/dashboard/pricing' },
  ];
}

// ---------------------------------------------------------------------------
// Loading skeleton — shown while the initial GET is in flight
// ---------------------------------------------------------------------------

/**
 * Matches the layout of the real branding form so there's no layout
 * shift when the data arrives. Uses `aria-busy` + `aria-live` so screen
 * readers know the region is loading.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Branding
 */
function BrandingSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <div className="h-5 w-20 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-40 w-full rounded-xl bg-slate-100 animate-pulse" />
        </Card>
        <Card>
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="h-12 flex-1 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="h-5 w-48 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-14 w-full bg-blue-50 rounded-lg mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-12 w-full bg-slate-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BrandingPage() {
  const router = useRouter();
  const brandingRef = useRef<BrandingFormHandle>(null);

  // Load the saved setup (shared with the org-setup page).
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

  const saveMutation = useApiMutation<OrgSetupResponse, SaveBrandingPayload>(
    '/api/org-setup',
    'put',
    { invalidateKeys: [ORG_SETUP_QUERY_KEY] },
  );

  const isSaving = saveMutation.isPending;

  // Old Author: samir
  // New Author: samir
  // Impact: branding completion now runs the strict Zod schema as the source of truth
  // Reason: replaces the hand-rolled "are these four fields filled" structural check. Using brandingSchema.safeParse means the stepper tick can never fall out of sync with the form's actual validation rules.
  const brandingComplete = useMemo(() => {
    if (!data) return false;
    return brandingSchema.safeParse(data.branding).success;
  }, [data]);

  // Author: samir
  // Impact: separate "email sender identity has been saved" flag, looser than brandingComplete
  // Reason: the green ✓ Saved badge in the email-sender card header should appear as soon as the user has saved either fromName or fromEmail at least once — not gated on the strict full-branding completion check used by the stepper. Matches the close-up in image #8.
  const emailSenderSaved = useMemo(() => {
    const branding = data?.branding;
    if (!branding) return false;
    return (
      (typeof branding.fromName === 'string' && branding.fromName.length > 0) ||
      (typeof branding.fromEmail === 'string' && branding.fromEmail.length > 0)
    );
  }, [data?.branding]);

  // Old Author: samir
  // New Author: samir
  // Impact: Org Info completion = ALL three sections (business + warehouse + payment) pass strict Zod validation, identical logic to org-setup/page.tsx
  // Reason: the org-setup page owns three forms, so ticking Org Info as done requires every section to validate. Using the schemas directly keeps both pages locked to the same source of truth.
  const orgInfoComplete = useMemo(() => {
    if (!data) return false;
    return (
      businessInfoSchema.safeParse(data.business).success &&
      warehouseLocationSchema.safeParse(data.warehouse).success &&
      paymentInvoiceSchema.safeParse(data.payment).success
    );
  }, [data]);

  const setupSteps = useMemo(
    () => buildSetupSteps(orgInfoComplete, brandingComplete),
    [orgInfoComplete, brandingComplete],
  );

  const completedCount = (orgInfoComplete ? 1 : 0) + (brandingComplete ? 1 : 0);

  /**
   * Maps an ApiError from the backend into a user-facing toast.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Branding
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
   * Save — persists the current form values as a draft so partial work
   * is preserved. Does not navigate away.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Branding
   */
  const handleSave = () => {
    if (isSaving) return;
    const current = brandingRef.current?.getFormData();

    saveMutation.mutate(
      { mode: 'draft', branding: current },
      {
        onSuccess: () => {
          toast.success('Branding saved.');
        },
        onError: handleMutationError,
      },
    );
  };

  /**
   * Next: Products — runs strict Zod validation and, if every field
   * passes, saves the branding section and navigates to the Products
   * step. The server re-validates with the same schema.
   *
   * @author samir
   * @created 2026-04-06
   * @module Module A - Branding
   */
  const handleNext = () => {
    if (isSaving) return;

    const branding = brandingRef.current?.validate();
    if (!branding) {
      toast.error('Please fix the highlighted fields in Branding.');
      return;
    }

    saveMutation.mutate(
      { mode: 'complete', branding },
      {
        onSuccess: () => {
          toast.success('Branding saved. Continuing to products.');
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
        <BrandingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <div className="text-center py-6">
            <p className="text-sm text-slate-700 font-medium">Couldn&apos;t load your branding.</p>
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

  const initialBranding = (data?.branding ?? undefined) as
    | Partial<BrandingFormData>
    | undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Branding Form */}
      <BrandingForm
        ref={brandingRef}
        initialData={initialBranding}
        saved={emailSenderSaved}
      />

      {/* Author: samir */}
      {/* Impact: buttons stack vertically on mobile, row on sm+; disabled while mutation is in flight */}
      {/* Reason: matches the org-setup page button row pattern so users see the same loading/disabled UX across Module A pages */}
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button
          variant="outline"
          size="lg"
          onClick={handleSave}
          loading={isSaving && saveMutation.variables?.mode === 'draft'}
          disabled={isSaving && saveMutation.variables?.mode !== 'draft'}
        >
          Save & Draft
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleNext}
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
