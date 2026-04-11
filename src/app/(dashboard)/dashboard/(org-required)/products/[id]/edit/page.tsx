"use client";

/**
 * Product Details / Edit route — thin wrapper around `ProductEditorForm`.
 *
 * Loads the product by id from the API via `useProduct(id)` and passes
 * it to the shared editor component (used by both /new and [id]/edit).
 *
 * Falls back to a friendly "not found" state when the API returns
 * 404 — usually a stale link or a soft-deleted row.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Old Author: Puran
// New Author: Puran
// Impact: swapped the mock lookup for the real `useProduct` query;
//         added skeleton + 404 + error states
// Reason: the Products API is live now — list and edit pages should
//         both round-trip through React Query so cache invalidation
//         after a save makes the new data flow into every open view.

import { use } from "react";
import { useRouter } from "next/navigation";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProductEditorForm } from "@/components/products/ProductEditorForm";
import { useProduct } from "@/hooks/products/useProducts";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductEditPage({ params }: PageProps) {
  // Next 16: params is a Promise; `use()` unwraps it inside a client
  // component without forcing the page to be a server component.
  const { id } = use(params);

  return (
    <ModuleGuard module="A">
      <ProductEditWrapper productId={id} />
    </ModuleGuard>
  );
}

/**
 * Resolves the product by id and renders one of:
 *   - skeleton (while React Query is fetching)
 *   - "not found" card (404 from the API)
 *   - the editor form (success)
 *
 * Split out so the ModuleGuard layer stays thin.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function ProductEditWrapper({ productId }: { productId: string }) {
  const router = useRouter();
  const { data: product, isLoading, error } = useProduct(productId);

  if (isLoading) {
    return <ProductEditSkeleton />;
  }

  // PRODUCT_NOT_FOUND comes back as a 404 with this code; anything else
  // is an unexpected failure (network / 500 / forbidden) — surface a
  // generic "couldn't load" card with the server's message so the user
  // gets a real reason instead of a blank screen.
  if (error || !product) {
    const isNotFound = error?.code === "PRODUCT_NOT_FOUND";
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-slate-900">
              {isNotFound ? "Product not found" : "Could not load product"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isNotFound
                ? "The product you're trying to edit doesn't exist or has been removed."
                : error?.message ?? "Something went wrong. Please try again."}
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="md"
                onClick={() => router.push("/dashboard/products")}
              >
                Back to products
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <ProductEditorForm initialProduct={product} />;
}

/**
 * Lightweight skeleton mirroring the editor's header + tab bar +
 * first card so the page doesn't flicker between layouts during
 * the initial fetch.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
function ProductEditSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-full bg-slate-100" />
          <div className="h-10 w-32 rounded-full bg-slate-200" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-slate-100" />
        ))}
      </div>
      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
          </div>
          <div className="h-24 rounded-2xl bg-slate-100" />
        </div>
      </Card>
    </div>
  );
}
