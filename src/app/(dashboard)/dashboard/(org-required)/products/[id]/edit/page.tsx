"use client";

/**
 * Product Details / Edit route — thin wrapper around `ProductEditorForm`.
 *
 * Loads the product by id from the mock dataset and passes it to the
 * shared editor component (used by both /new and [id]/edit). When the
 * backend lands this is the place to swap mock lookup for `useProduct(id)`.
 *
 * Falls back to a friendly "not found" state when the requested id
 * doesn't exist in the dataset (e.g. user navigates by hand or comes
 * from a stale link).
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Old Author: Puran
// New Author: Puran
// Impact: trimmed from a 600+ line page to a thin wrapper now that
//         ProductEditorForm owns all the UI
// Reason: same Figma is used by /new and [id]/edit, so the editor
//         body lives in one shared component and both routes thinly
//         pass the right initial state

import { use } from "react";
import { useRouter } from "next/navigation";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProductEditorForm } from "@/components/products/ProductEditorForm";
import { findMockProduct } from "@/lib/mock-products";

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
 * Resolves the product by id and renders either the editor or a
 * "not found" card. Split out so the ModuleGuard layer stays thin.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function ProductEditWrapper({ productId }: { productId: string }) {
  const router = useRouter();
  const product = findMockProduct(productId);

  if (!product) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Product not found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              The product you&rsquo;re trying to edit doesn&rsquo;t exist or
              has been removed.
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
