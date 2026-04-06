/**
 * GET + PUT /api/org-setup — Module A onboarding persistence.
 *
 * Backs the Save Draft / Save & Continue buttons on /dashboard/org-setup.
 * Stores business info, warehouse location, and payment settings as JSON
 * columns on the OrgSetup table (1:1 with Organization) so drafts can
 * round-trip partial data while COMPLETE status guarantees full Zod
 * validation (PROJECT_RULES.md §4.6, §5.1, §6.3, §8.3).
 *
 * Onboarding edge: a user who just signed up has `orgId = null`. This
 * route therefore uses `requireAuth` only and auto-creates the
 * Organization on first save, linking the user. After the first save the
 * user has an orgId and every subsequent request is multi-tenant scoped.
 *
 * Multi-tenant (§2.1): every OrgSetup query includes orgId derived from
 * the session (never from the client body).
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */

// Author: samir
// Impact: new API route backing the org-setup page Save Draft / Save & Continue flow
// Reason: page was holding data in local state only; Module A progress needs to persist across sessions

import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import {
  requireAuth,
  requirePermission,
  type AuthContext,
} from "@/server/lib/auth/guards";
import { logger } from "@/server/lib/logger";
import { orgSetupSaveSchema } from "@/lib/validation/org-setup";
import { OrgSetupStatus } from "@/generated/prisma/enums";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
// Author: samir
// Impact: type-only imports of the admin form data shapes so the API response is fully typed
// Reason: the API was using `unknown` for business/warehouse/payment which pushed casts onto every caller. `import type` is erased at compile time so pulling types from 'use client' components is safe and adds zero runtime cost.
import type { BusinessFormData } from "@/components/admin/BusinessInfoForm";
import type { WarehouseFormData } from "@/components/admin/WarehouseLocationForm";
import type { PaymentFormData } from "@/components/admin/PaymentInvoiceForm";

const ROUTE = "/api/org-setup";

/**
 * Shape of each section stored in the OrgSetup JSON columns.
 *
 * Because drafts may be missing fields, we wrap the form interfaces in
 * Partial<>. When the row is in COMPLETE status every field will be
 * present, but the type system can't prove that at read-time so we
 * keep the weaker type and let the client re-validate if needed.
 */
export type OrgSetupBusinessSection = Partial<BusinessFormData>;
export type OrgSetupWarehouseSection = Partial<WarehouseFormData>;
export type OrgSetupPaymentSection = Partial<PaymentFormData>;

/** Shape returned to the client for both GET and PUT. */
export interface OrgSetupResponse {
  status: OrgSetupStatus;
  business: OrgSetupBusinessSection | null;
  warehouse: OrgSetupWarehouseSection | null;
  payment: OrgSetupPaymentSection | null;
  updatedAt: string;
}

/**
 * Narrows a Prisma JsonValue to `Partial<T>` when it's a plain object.
 * Arrays, scalars, and JSON null all collapse to `null` so downstream
 * code doesn't have to worry about mis-shaped legacy data.
 *
 * @param value - Raw value pulled from a Prisma Json column
 * @returns The value cast to Partial<T> when it's a plain object, null otherwise
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
function asJsonObject<T extends object>(value: unknown): Partial<T> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Partial<T>;
  }
  return null;
}

/**
 * Loads the OrgSetup row for the caller's org (if any).
 * Returns null when the user has no org yet (fresh signup) or when the
 * org exists but no setup row has been written.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
async function loadOrgSetup(orgId: string | null): Promise<OrgSetupResponse | null> {
  if (!orgId) return null;

  const row = await db.orgSetup.findFirst({
    // Multi-tenant scope (§2.1)
    where: { orgId, deletedAt: null },
    select: {
      status: true,
      business: true,
      warehouse: true,
      payment: true,
      updatedAt: true,
    },
  });

  if (!row) return null;

  return {
    status: row.status,
    business: asJsonObject<BusinessFormData>(row.business),
    warehouse: asJsonObject<WarehouseFormData>(row.warehouse),
    payment: asJsonObject<PaymentFormData>(row.payment),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * GET /api/org-setup — returns the current saved setup for the caller's org.
 *
 * Response:
 * - 200 { success: true, data: OrgSetupResponse | null }
 * - 401 not authenticated
 * - 403 insufficient permission
 *
 * Returns `data: null` when no setup has been saved yet (including when
 * the user hasn't been attached to an org) — the page treats this as a
 * blank form.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const permResult = requirePermission(authResult, "org.settings.read");
    if (permResult instanceof Response) return permResult;

    const data = await loadOrgSetup(authResult.orgId);

    const response = success<OrgSetupResponse | null>(data);
    // Per-user data — never let a shared cache serve another user's setup.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    logger.error("Failed to fetch org setup", ctx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while loading your setup. Please try again.",
      500,
    );
  }
}

/**
 * PUT /api/org-setup — upserts the caller's org setup.
 *
 * Body (discriminated on `mode`):
 * - `{ mode: "draft",    business?, warehouse?, payment? }` — loose, partial
 * - `{ mode: "complete", business, warehouse, payment }`   — strict
 *
 * Side effects:
 * - If the user has no Organization yet, one is created and linked. The
 *   Organization.name is derived from `business.businessName` when
 *   available, otherwise falls back to `"${user.fullName}'s Organization"`.
 *   This is the only endpoint in the app that may create an org for a
 *   logged-in user, which is why it does NOT use requireOrg.
 * - Upserts the OrgSetup row keyed by the resulting orgId.
 * - Draft mode never downgrades status. Complete mode sets status to
 *   COMPLETE.
 *
 * Responses:
 * - 200 { success: true, data: OrgSetupResponse }
 * - 400 VALIDATION_ERROR with per-field details
 * - 401 UNAUTHORIZED
 * - 403 FORBIDDEN (missing org.settings.write permission)
 * - 500 INTERNAL_ERROR
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */
export async function PUT(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const baseCtx = { route: ROUTE, requestId };

  try {
    // Step 1: Authenticate. Note: we intentionally do NOT call requireOrg
    // here — a brand-new user has no orgId until their first save.
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    // Step 2: RBAC. The org-setup page is Admin-only; the permission
    // check is still performed explicitly so future roles can be added
    // to ROLE_PERMISSIONS without code changes here.
    const permResult = requirePermission(authResult, "org.settings.write");
    if (permResult instanceof Response) return permResult;

    const authCtx: AuthContext = authResult;
    const logCtx = { ...baseCtx, userId: authCtx.userId };

    // Step 3: Parse + validate input against the discriminated schema.
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = orgSetupSaveSchema.safeParse(rawBody);
    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    }

    const payload = parsed.data;

    // Step 4: Resolve (or create) the organization this setup belongs to.
    // We grab a best-effort org name from whatever business data the
    // request carries; drafts may not include one yet.
    const candidateName =
      typeof payload.business === "object" && payload.business !== null
        ? (payload.business as { businessName?: string }).businessName?.trim()
        : undefined;

    const fallbackName = `${authCtx.fullName}'s Organization`;
    const orgName = candidateName && candidateName.length > 0 ? candidateName : fallbackName;

    let orgId = authCtx.orgId;
    let orgCreated = false;

    if (!orgId) {
      // First save for this user — create the org and link it atomically.
      // We don't want a partially-linked user, so both writes go through
      // a single interactive transaction.
      const created = await db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName },
          select: { id: true },
        });
        await tx.user.update({
          where: { id: authCtx.userId },
          data: { orgId: org.id },
        });
        return org;
      });

      orgId = created.id;
      orgCreated = true;
      logger.info("Org created during setup", { ...logCtx, orgId });
    } else if (candidateName) {
      // Keep Organization.name in sync with whatever business name the
      // user is currently typing. This is a best-effort convenience —
      // the source of truth stays inside OrgSetup.business.
      await db.organization.update({
        where: { id: orgId },
        data: { name: candidateName },
      });
    }

    // Step 5: Upsert the OrgSetup row.
    //
    // - Draft mode: write whatever the client sent, keep the existing
    //   status (DRAFT for new rows, possibly COMPLETE if the user is
    //   saving changes to an already-completed setup).
    // - Complete mode: write the validated data and flip status to
    //   COMPLETE.
    const nowIso = new Date();
    let newStatus: OrgSetupStatus;
    if (payload.mode === "complete") {
      newStatus = OrgSetupStatus.COMPLETE;
    } else {
      // Preserve prior status on draft writes so users who already
      // completed setup don't get silently downgraded when they edit.
      const existing = await db.orgSetup.findUnique({
        where: { orgId },
        select: { status: true },
      });
      newStatus = existing?.status ?? OrgSetupStatus.DRAFT;
    }

    // Prisma Json columns: passing `undefined` means "don't touch this
    // field" on update, which is what we want when a draft request omits
    // a section — we preserve whatever was previously stored instead of
    // wiping it. The Save Draft button in our UI always sends all three
    // sections, but we guard anyway.
    const business = payload.business as InputJsonValue | undefined;
    const warehouse = payload.warehouse as InputJsonValue | undefined;
    const payment = payload.payment as InputJsonValue | undefined;

    const saved = await db.orgSetup.upsert({
      where: { orgId },
      create: {
        orgId,
        status: newStatus,
        business,
        warehouse,
        payment,
      },
      update: {
        status: newStatus,
        business,
        warehouse,
        payment,
        updatedAt: nowIso,
      },
      select: {
        status: true,
        business: true,
        warehouse: true,
        payment: true,
        updatedAt: true,
      },
    });

    logger.info("Org setup saved", {
      ...logCtx,
      orgId,
      mode: payload.mode,
      status: saved.status,
      orgCreated,
    });

    const response = success<OrgSetupResponse>({
      status: saved.status,
      business: asJsonObject<BusinessFormData>(saved.business),
      warehouse: asJsonObject<WarehouseFormData>(saved.warehouse),
      payment: asJsonObject<PaymentFormData>(saved.payment),
      updatedAt: saved.updatedAt.toISOString(),
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    logger.error("Failed to save org setup", baseCtx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while saving your setup. Please try again.",
      500,
    );
  }
}
