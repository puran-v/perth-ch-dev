"use client";

/**
 * React Query hooks for the Product Variants API
 * (`/api/orgs/current/products/[id]/variants` + `/[variantId]`).
 *
 * Variants are children of a SIZE_VARIANT product. The hooks here
 * mutate one variant at a time — bulk save is orchestrated in
 * `ProductEditorForm.handleSave` after the parent product save
 * commits (per the Phase 2 sign-off).
 *
 * Mirrors the existing `useProducts.ts` shape so the products
 * domain has a single, predictable hook style. Cache invalidation
 * always points at the parent product's detail key, NOT a
 * dedicated variants key — the API ships variants alongside the
 * product on every GET, so the only thing the form ever needs to
 * refetch is the product detail row.
 *
 * @example
 * const create = useCreateVariant(productId);
 * await create.mutateAsync({ label: "Medium", priceDay: 280, quantity: 2 });
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variant hooks)
 */

// Author: Puran
// Impact: typed variant hooks — create / update / delete one
//         variant at a time
// Reason: Phase 2 of the Configurable Product Pricing rollout —
//         the form orchestrates bulk save in handleSave by calling
//         these one-shot hooks in sequence. Avoids a new bulk API
//         contract while still keeping the form responsive.

import { useApiMutation } from "@/hooks/useApiMutation";
import { productQueryKey, PRODUCTS_QUERY_KEY } from "@/hooks/products/useProducts";
import type {
  CreateVariantInput,
  ProductVariant,
  UpdateVariantInput,
} from "@/types/products";

/**
 * Creates a new variant on a SIZE_VARIANT product. Invalidates
 * BOTH the parent product's detail cache and the products list
 * cache so any open list page picks up the new variant in its
 * stock totals.
 *
 * The parent product MUST exist before this is called. Calling it
 * with a not-yet-saved product (no id) will produce a 404 — the
 * form gates the variants UI on `mode === "edit"` to prevent that.
 *
 * @param productId - Parent product id
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variant hooks)
 */
export function useCreateVariant(productId: string) {
  return useApiMutation<ProductVariant, CreateVariantInput>(
    `/api/orgs/current/products/${productId}/variants`,
    "post",
    {
      // Invalidate both keys: the product detail (variants are
      // included in the GET response) and the products list
      // (stock totals derive from variants on SIZE_VARIANT rows).
      invalidateKeys: [productQueryKey(productId), PRODUCTS_QUERY_KEY],
    }
  );
}

/**
 * Updates a single variant. Same invalidation scope as create —
 * the parent detail re-fetch is the source of truth for the form
 * after the round-trip.
 *
 * @param productId - Parent product id
 * @param variantId - Variant to update
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variant hooks)
 */
export function useUpdateVariant(productId: string, variantId: string) {
  return useApiMutation<ProductVariant, UpdateVariantInput>(
    `/api/orgs/current/products/${productId}/variants/${variantId}`,
    "patch",
    {
      invalidateKeys: [productQueryKey(productId), PRODUCTS_QUERY_KEY],
    }
  );
}

/**
 * Soft-deletes a single variant. The server returns a generic
 * success today; when reservations land it'll return 409
 * VARIANT_IN_USE if any active reservation references the variant
 * — the form should surface that as a toast asking the admin to
 * reassign the affected bookings first.
 *
 * @param productId - Parent product id
 * @param variantId - Variant to delete
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variant hooks)
 */
export function useDeleteVariant(productId: string, variantId: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/products/${productId}/variants/${variantId}`,
    "del",
    {
      invalidateKeys: [productQueryKey(productId), PRODUCTS_QUERY_KEY],
    }
  );
}
