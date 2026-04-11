"use client";

/**
 * Add Product route — thin wrapper around `ProductEditorForm` that
 * passes `initialProduct={null}` to put the form in create mode.
 *
 * Same Figma as the edit route — only the starting state and a few
 * labels (header placeholder, save button copy, post-save toast) differ.
 * The form component owns all of that branching internally so this
 * file stays a one-line render.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Author: Puran
// Impact: new /dashboard/products/new route entry for the Add Product
//         flow, shares ProductEditorForm with the edit route
// Reason: user pointed out that Add / Details / Edit are one Figma
//         design — single component, two thin route wrappers

import { ModuleGuard } from "@/components/auth/ModuleGuard";
import { ProductEditorForm } from "@/components/products/ProductEditorForm";

export default function NewProductPage() {
  return (
    <ModuleGuard module="A">
      <ProductEditorForm initialProduct={null} />
    </ModuleGuard>
  );
}
