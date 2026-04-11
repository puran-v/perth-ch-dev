"use client";

/**
 * Products list page — Module A step 4 of the org-setup flow.
 *
 * Shows the hire catalogue: a stats strip on top + a single rounded
 * "Product catalogue" card containing the product table on desktop and
 * a stacked card view below the md breakpoint (PROJECT_RULES.md §8.4).
 * The footer Save / Next: Bundles row mirrors the Branding page so the
 * setup flow feels uniform.
 *
 * Backend status: the Product model and /api/orgs/current/products
 * endpoint do NOT exist yet. The page renders against MOCK_PRODUCTS
 * defined below and is structured so wiring `useProducts()` later is a
 * single import swap. Every action button (Add product, Import CSV,
 * Edit) is a stub toast for the same reason — no silent failures, no
 * fake data round-trips, just clear "coming soon" feedback.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Author: Puran
// Impact: replaced the stub h1 with the full Figma layout — stats row,
//         catalogue card, mobile cards, setup-flow nav buttons
// Reason: this is the first real Module A page the operator hits after
//         finishing the Team step. UI ships first; backend follows.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useProductList } from "@/hooks/products/useProducts";
import { useCategories } from "@/hooks/products/useCategories";
import type { ProductRow, ProductStats, ProductStatus } from "@/types/products";

// ─── Page entry ────────────────────────────────────────────────────────

export default function ProductsPage() {
  return (
    <ModuleGuard module="A">
      <ProductsCatalogue />
    </ModuleGuard>
  );
}

// ─── Catalogue body ────────────────────────────────────────────────────

/**
 * Renders the products catalogue inside the ModuleGuard. Split out so
 * the guard layer stays as thin as possible.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function ProductsCatalogue() {
  const router = useRouter();

  // Author: Puran
  // Impact: real catalogue fetch via React Query
  // Reason: replaces MOCK_PRODUCTS — when a save lands on the editor
  //         page the products cache is invalidated and this list
  //         refetches automatically.
  const { data, isLoading, error } = useProductList();
  const products: ProductRow[] = useMemo(() => data ?? [], [data]);

  // Author: Puran
  // Impact: stat counts the org's master category list, not the
  //         distinct values in products
  // Reason: master list is the truth — counting distinct strings
  //         double-counted casing variants and undercounted empty
  //         categories that exist but have no products yet. The
  //         hook is cached for 5 min so the page hits the network
  //         once and reuses the data with the editor combobox.
  const { data: categoriesData } = useCategories();
  const allCategories = useMemo(() => categoriesData ?? [], [categoriesData]);

  // Author: Puran
  // Impact: derive the four stats card numbers from the product list
  // Reason: V1 is small enough that client aggregation is free; once
  //         the list grows past a single page the backend can return
  //         these counts directly via /api/orgs/current/products/stats.
  const stats: ProductStats = useMemo(() => {
    const needsPricing = products.filter((p) => p.status === "NO_PRICE").length;
    const inactive = products.filter(
      (p) => p.status === "INACTIVE" || p.status === "MAINTENANCE",
    ).length;
    return {
      total: products.length,
      categories: allCategories.length,
      needsPricing,
      inactive,
    };
  }, [products, allCategories.length]);

  // ── Action handlers ──────────────────────────────────────────────────
  //
  // Every CRUD action is currently a stub toast. They're wired here so
  // the buttons aren't dead clicks — when the API lands these will turn
  // into mutations / route pushes without changing the JSX.

  const handleAddProduct = () => {
    router.push("/dashboard/products/new");
  };

  const handleImportCsv = () => {
    router.push("/dashboard/csv-import");
  };

  const handleEdit = (product: ProductRow) => {
    router.push(`/dashboard/products/${product.id}/edit`);
  };

  const handleSave = () => {
    toast.success("Catalogue saved.");
  };

  const handleNext = () => {
    router.push("/dashboard/bundles");
  };

  // Sample category preview shown in the Categories stat card. Slicing
  // here keeps the card compact even when the org has many categories.
  // Author: Puran
  // Impact: previews from the master category list, not from product
  //         strings, so empty categories also show
  // Reason: aligns with stats.categories which now counts the master
  //         list. Reading from `allCategories` instead of products
  //         means a fresh org that just added "Inflatable" sees it
  //         in the preview before they've added their first product.
  const categoryPreview = useMemo(() => {
    const names = allCategories.slice(0, 2).map((c) => c.name);
    const suffix = allCategories.length > 2 ? "…" : "";
    return names.join(", ") + suffix;
  }, [allCategories]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your hire catalogue. Every product here is available in the quote builder.
        </p>
      </div>

      {/* Stats row — 1 col on mobile, 2 on tablet, 4 on lg+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total products"
          value={stats.total}
          footer="All active"
          footerVariant="success"
        />
        <StatCard
          label="Categories"
          value={stats.categories}
          footer={stats.categories > 0 ? categoryPreview : "None yet"}
          footerVariant="muted"
        />
        <StatCard
          label="Needs pricing"
          value={stats.needsPricing}
          footer="Set price"
          footerVariant="warning"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          footer="Maintenance"
          footerVariant="muted"
        />
      </div>

      {/* Catalogue card */}
      <Card padding="none">
        {/* Card header — title left, actions right; stacks on small */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">
            Product catalogue
          </h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportCsv}
            >
              <UploadIcon />
              Import CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddProduct}
            >
              Add product +
            </Button>
          </div>
        </div>

        {/* Body — loading OR error OR empty state OR table+cards */}
        {isLoading ? (
          <div className="px-5 py-10 sm:px-6">
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="px-5 py-10 sm:px-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Could not load products
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {error.message}
            </p>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Add your first product or import from CSV to get started."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handleImportCsv}>
                  Import CSV
                </Button>
                <Button variant="primary" size="sm" onClick={handleAddProduct}>
                  Add product +
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Author: Puran */}
            {/* Impact: switched table breakpoint from md → xl */}
            {/* Reason: at iPad Pro (1024) the sidebar (280) + page */}
            {/*         padding (~64) leaves only ~680px usable, so the */}
            {/*         min-w-[900] table overflowed and chopped off the */}
            {/*         Status + Edit columns. xl (1280) gives ~936px */}
            {/*         usable which the table fits in cleanly; iPad Pro */}
            {/*         and below now show the mobile card layout, which */}
            {/*         is the responsive call this layout always wanted. */}
            {/* Desktop table — only at xl+ where there's enough room. */}
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-black">
                    <tr className="font-medium">
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Name</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Category</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Qty</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Base price</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Setup</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Packdown</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3">Status</th>
                      <th className="whitespace-nowrap font-medium text-black px-6 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="font-normal hover:bg-slate-50/40">
                        <td className="px-6 py-4">
                          <p className="text-sm font-normal text-slate-600">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-400">{p.sku}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {/* Author: Puran */}
                          {/* Impact: prefer the canonical name from the */}
                          {/*         categoryRef join over the legacy */}
                          {/*         free-text column */}
                          {/* Reason: dual-write rollout — categoryRef is */}
                          {/*         the truth once a row goes through */}
                          {/*         the new combobox; the legacy string */}
                          {/*         is the fallback for any row that */}
                          {/*         hasn't been re-saved yet */}
                          {p.categoryRef?.name ?? p.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {p.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatPrice(p.basePrice)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {p.setupMinutes} min
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {p.packdownMinutes} min
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <PencilIcon />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile + tablet + iPad Pro cards — same data, vertical
                layout, one per row. Each card uses the same Edit pill
                + status pill so the two layouts feel like the same UI
                in different shapes. xl:hidden to mirror the table's
                xl-only visibility above. */}
            <div className="flex flex-col divide-y divide-slate-100 xl:hidden">
              {products.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-normal text-slate-600">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400">{p.sku}</p>
                    </div>
                    <StatusPill status={p.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex flex-col">
                      <dt className="text-slate-400">Category</dt>
                      <dd className="text-slate-700">
                        {p.categoryRef?.name ?? p.category}
                      </dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-slate-400">Qty</dt>
                      <dd className="text-slate-700">{p.quantity}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-slate-400">Base price</dt>
                      <dd className="text-slate-700">{formatPrice(p.basePrice)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-slate-400">Setup / Packdown</dt>
                      <dd className="text-slate-700">
                        {p.setupMinutes} / {p.packdownMinutes} min
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(p)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <PencilIcon />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Author: Puran */}
      {/* Impact: setup-flow nav row matching the Branding page contract */}
      {/* Reason: Products is Module A step 4 — the Save + Next: Bundles */}
      {/*         buttons live at the bottom of the page like the other */}
      {/*         setup screens so the flow feels consistent. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button variant="outline" size="lg" onClick={handleSave}>
          Save Draft
        </Button>
        <Button variant="primary" size="lg" onClick={handleNext}>
          <span className="flex items-center justify-center gap-2">
            Save & Continue
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  footer: string;
  footerVariant: "success" | "warning" | "muted";
}

/**
 * Compact stat card used in the row above the catalogue. Mirrors the
 * Figma layout (label top, big number middle, coloured footer line)
 * which the shared `StatsCard` doesn't fit because it expects an icon.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function StatCard({ label, value, footer, footerVariant }: StatCardProps) {
  const footerClass =
    footerVariant === "success"
      ? "text-green-600"
      : footerVariant === "warning"
      ? "text-amber-600"
      : "text-slate-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className={`mt-2 text-xs font-medium ${footerClass}`}>{footer}</p>
    </div>
  );
}

/**
 * Outlined status pill — same shape language as the UsersTab RolePill
 * (border + light bg + dark text). Page-local because the variants are
 * specific to product lifecycle and the shared Badge primitive uses a
 * different (solid-fill) visual.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function StatusPill({ status }: { status: ProductStatus }) {
  const variantClass =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "MAINTENANCE"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "NO_PRICE"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  const label = STATUS_LABELS[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${variantClass}`}
    >
      {label}
    </span>
  );
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  MAINTENANCE: "Maintenance",
  NO_PRICE: "No Price",
  INACTIVE: "Inactive",
};

// Pencil icon — kept inline so the Edit pill stays self-contained.
// Same SVG path UsersTab uses; if it's needed in a third place we
// extract it to components/ui/Icons.
function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 13.5V18a2.25 2.25 0 01-2.25 2.25h-12A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h4.5"
      />
    </svg>
  );
}

// Upload arrow icon for the Import CSV button.
function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0l-4 4m4-4l4 4"
      />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Formats a whole-dollar price as `$280/day`. Returns "—" for zero so
 * NO_PRICE rows render a placeholder instead of "$0/day" which would
 * read like a real (free) price.
 */
function formatPrice(dollars: number): string {
  if (!dollars || dollars <= 0) return "—";
  return `$${dollars}/day`;
}
