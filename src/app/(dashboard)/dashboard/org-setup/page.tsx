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
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from '@/hooks/useCurrentUser';
// Author: Puran
// Impact: derive Team-step completion from live member + invitation lists
// Reason: the stepper green tick on the org-setup progress card should
//         flip on as soon as the user has at least one teammate (member
//         or pending invite, excluding the founder), matching the same
//         "hasTeammate" gate the team page enforces on Save & Continue
import { useMembers } from '@/hooks/team/useMembers';
import { useInvitations } from '@/hooks/team/useInvitations';
import { ApiError } from '@/lib/api-client';
import {
  type BusinessInfoInput,
  type WarehouseLocationInput,
  type PaymentInvoiceInput,
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
      // Author: samir
      // Impact: tells the server which onboarding step to tick on completion
      // Reason: server merges this into OrgSetup.completedSteps; the stepper tick is only allowed to flip on via Save & Continue
      completedStep: 'org-info';
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
 * Builds the stepper steps for the Module A progress card.
 *
 * Both org-info and branding completion are tracked independently so
 * the user can return to /dashboard/org-setup after saving branding
 * and see Branding rendered as ✓ completed instead of "current".
 *
 * Old Author: samir
 * New Author: samir
 * Impact: stepper now reflects branding completion as well as org-info
 * Reason: when the user finishes the branding step and clicks "Save & Continue", the org-setup stepper kept showing Branding as the current step. This function now takes a separate brandingComplete flag (computed from the same React Query payload) so the tick/current/pending states stay accurate after either page saves.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
function buildSetupSteps(
  orgInfoComplete: boolean,
  brandingComplete: boolean,
  teamComplete: boolean,
): StepperStep[] {
  // The Org Info step is "current" when nothing is complete yet, then
  // "completed" once business info is saved. Branding follows the same
  // pattern but only after org info is done.
  const orgInfoStatus: StepperStep['status'] = orgInfoComplete
    ? 'completed'
    : 'current';
  const brandingStatus: StepperStep['status'] = brandingComplete
    ? 'completed'
    : orgInfoComplete
    ? 'current'
    : 'pending';
  // Old Author: samir
  // New Author: Puran
  // Impact: Team step now flips to 'completed' once the org has at least one
  //         teammate, instead of staying stuck on 'current' forever.
  // Reason: client wanted the green tick to appear after Save & Continue on
  //         the team page. Completion is derived from useMembers +
  //         useInvitations (no extra DB column needed) so any path that adds
  //         a teammate keeps the stepper in sync.
  const teamStatus: StepperStep['status'] = teamComplete
    ? 'completed'
    : brandingComplete
    ? 'current'
    : 'pending';

  return [
    {
      id: 'org-info',
      label: 'Org Info',
      status: orgInfoStatus,
      stepNumber: 1,
      href: '/dashboard/org-setup',
    },
    {
      id: 'branding',
      label: 'Branding',
      status: brandingStatus,
      stepNumber: 2,
      href: '/dashboard/branding',
    },
    { id: 'team', label: 'Team', status: teamStatus, stepNumber: 3, href: '/dashboard/team' },
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

  // Author: Puran
  // Impact: read currentUser to know whether the user already has an org —
  //         drives the Save Draft visibility gate below
  // Reason: drafts can only persist once an org exists. Showing the button
  //         before that would either (a) silently create an org from a half-
  //         filled form (the bug we're fixing) or (b) hit the new server
  //         guard and toast an error. Hiding it is the only honest UX.
  const { data: currentUser } = useCurrentUser();
  const hasOrg = !!currentUser?.orgId;

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

  // Old Author: samir
  // New Author: Puran
  // Impact: also invalidate CURRENT_USER_QUERY_KEY on save
  // Reason: PUT /api/org-setup creates the Organization + attaches user.orgId
  //         on first save. The sidebar wrapper reads `currentUser.orgId` from
  //         the React Query cache to decide whether to redirect orphan users
  //         to this page. Without invalidating, the cache keeps returning
  //         orgId: null even after the org exists → user gets redirected
  //         back here forever when they try to navigate to Roles/Team/etc.
  const saveMutation = useApiMutation<OrgSetupResponse, SaveOrgSetupPayload>(
    '/api/org-setup',
    'put',
    { invalidateKeys: [ORG_SETUP_QUERY_KEY, CURRENT_USER_QUERY_KEY] },
  );

  const isSaving = saveMutation.isPending;

  // Old Author: samir
  // New Author: samir
  // Impact: Org Info completion is now driven by the persisted completedSteps array
  // Reason: previously this re-ran the three Zod schemas on saved data, which meant Save & Draft of complete data ticked the step too. Reading from completedSteps means the tick only flips on after the user explicitly clicks Save & Continue on this page.
  const orgInfoComplete = useMemo(() => {
    return data?.completedSteps?.includes('org-info') ?? false;
  }, [data]);

  // Old Author: samir
  // New Author: samir
  // Impact: branding completion is now driven by the persisted completedSteps array
  // Reason: same fix as orgInfoComplete — the stepper tick must reflect an explicit Save & Continue action, not whatever happens to validate.
  const brandingComplete = useMemo(() => {
    return data?.completedSteps?.includes('branding') ?? false;
  }, [data]);

  // Author: Puran
  // Impact: pull live members + invitations so the Team step can flip to
  //         "completed" when there's at least one teammate. React Query
  //         dedupes these queries against the team page, so calling them
  //         here is free if the user has already visited /dashboard/team.
  // Reason: matches the same gate the team page uses on Save & Continue —
  //         single source of truth for "has the user added anyone yet?".
  //         Soft-deleted users are excluded by the API; consumed/revoked
  //         invites are excluded by useInvitations.
  const { data: members } = useMembers();
  const { data: invitations } = useInvitations();
  const teamComplete = useMemo(() => {
    const memberCount = members?.length ?? 0;
    const pendingInviteCount = (invitations ?? []).filter(
      (i) => !i.consumedAt && !i.revokedAt,
    ).length;
    return memberCount + pendingInviteCount > 0;
  }, [members, invitations]);

  // Only render forms once the initial load has resolved. This avoids
  // the "flash of empty form" race when initialData arrives late — the
  // forms capture initialData into local state on mount and never re-read
  // it, so the parent must gate rendering on the query result.
  const setupSteps = useMemo(
    () => buildSetupSteps(orgInfoComplete, brandingComplete, teamComplete),
    [orgInfoComplete, brandingComplete, teamComplete],
  );

  const completedCount =
    (orgInfoComplete ? 1 : 0) +
    (brandingComplete ? 1 : 0) +
    (teamComplete ? 1 : 0);

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
        completedStep: 'org-info',
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

      {/* Author: samir */}
      {/* Impact: completedCount now reflects org-info AND branding completion, not just the legacy status flag */}
      {/* Reason: previously the count was hard-coded to 1 if status === COMPLETE which couldn't progress past Org Info — once a user completes branding the header should read "2 / 6 complete" to match the stepper ticks. */}
      {/* Setup Progress */}
      <SetupProgressCard
        title="Module A setup progress"
        completedCount={completedCount}
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
      {/* First-run helper — explains why Save Draft isn't here yet */}
      {!hasOrg && (
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                Finish this step to create your organization
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Fill in Business Information, Warehouse Location, and Payment
                &amp; Invoice Settings, then click <strong>Save &amp; Continue</strong>.
                Drafts and the rest of the modules unlock once your organization
                is created.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Author: Puran */}
      {/* Impact: first-time admins (no org yet) only see "Save & Continue".
          Save Draft appears once the org has been created via the first
          successful Save & Continue. */}
      {/* Reason: drafts have nowhere to live without an org row, and we
          refuse to create the org from a partial draft — that was creating
          ghost tenants when users abandoned the form mid-fill. */}
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        {hasOrg && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleSaveDraft}
            loading={isSaving && saveMutation.variables?.mode === 'draft'}
            disabled={isSaving && saveMutation.variables?.mode !== 'draft'}
          >
            Save Draft
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={handleSaveAndContinue}
          loading={isSaving && saveMutation.variables?.mode === 'complete'}
          disabled={isSaving && saveMutation.variables?.mode !== 'complete'}
        >
          <span className="flex items-center justify-center gap-2">
            Save &amp; Continue
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Button>
      </div>
    </div>
  );
}
