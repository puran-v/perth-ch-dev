"use client";

/**
 * ProductEditorForm — shared multi-tab editor used by both the
 * **Add Product** and **Edit Product** routes.
 *
 * The Figma is a single design that serves three modes:
 *   1. Create  → /dashboard/products/new           (initialProduct = null)
 *   2. Details → /dashboard/products/[id]/edit     (initialProduct = row)
 *   3. Edit    → same route as 2, just user-edited (initialProduct = row)
 *
 * Mode 2 and 3 share the same code path; mode 1 differs only in the
 * starting state and a few labels (header subtitle, save button copy,
 * post-save toast). Keeping it as one component means the form layout,
 * tab logic, validation rules, and visual language can never drift
 * between create and edit.
 *
 * Backend status: Product model and /api/orgs/current/products
 * endpoint don't exist yet. Form state is local; Save Changes /
 * Discard / image upload / tag mutations are all client-side stubs.
 * When the backend lands, swap the toast in `handleSave` for a
 * `useApiMutation('/api/orgs/current/products[/:id]', mode === 'create' ? 'post' : 'patch')`
 * call — no other changes needed.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Author: Puran
// Impact: extracted the editor body out of the [id]/edit route file so
//         /new can render the same form without duplicating ~600 lines
// Reason: the user pointed out that Add / Details / Edit are one Figma
//         design — single component is the right pattern. Route files
//         become thin wrappers that just pass the right initial state.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { PricingTab } from "@/components/products/PricingTab";
import { InventoryTab } from "@/components/products/InventoryTab";
import { OperationalTab } from "@/components/products/OperationalTab";
import { WarehouseTab } from "@/components/products/WarehouseTab";
import { NotesRulesTab } from "@/components/products/NotesRulesTab";
import { ConfigurationTab } from "@/components/products/ConfigurationTab";
import type { ProductDetail } from "@/lib/mock-products";
import type { ProductStatus } from "@/types/products";

interface ProductEditorFormProps {
  /**
   * Existing product when in edit mode; null when in create mode.
   * The component derives `mode` internally from this so callers
   * never have to pass both.
   */
  initialProduct: ProductDetail | null;
}

// ─── Tab definitions ───────────────────────────────────────────────────

type TabId =
  | "basic"
  | "pricing"
  | "inventory"
  | "operational"
  | "warehouse"
  | "configuration"
  | "notes";

interface TabConfig {
  id: TabId;
  label: string;
  /** Optional leading icon — only Configuration uses one for now */
  icon?: React.ComponentType<{ className?: string }>;
}

// Old Author: Puran
// New Author: Puran
// Impact: Configuration tab is now ALWAYS present in the tab bar,
//         regardless of the Configurable product toggle
// Reason: client confirmed via the latest Figma that Configuration is
//         a permanent tab — the Configurable toggle in Basic Info now
//         only controls the inline summary chips inside that card,
//         not the visibility of the tab itself. Keeps the tab bar
//         consistent across all products and removes the "where did
//         my tab go" confusion when toggling.
const TABS: TabConfig[] = [
  { id: "basic", label: "Basic Info" },
  { id: "pricing", label: "Pricing" },
  { id: "inventory", label: "Inventory" },
  { id: "operational", label: "Operational" },
  { id: "warehouse", label: "Warehouse" },
  { id: "configuration", label: "Configuration", icon: CogIcon },
  { id: "notes", label: "Notes & Rules" },
];

// ─── Editor body ───────────────────────────────────────────────────────

/**
 * The actual editor. Mode is derived from `initialProduct`:
 *   - null  → create
 *   - row   → edit
 *
 * Form state is seeded once on mount and never re-read from the prop,
 * so the user can edit-then-discard without losing the original
 * values from the parent.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
export function ProductEditorForm({ initialProduct }: ProductEditorFormProps) {
  const router = useRouter();

  // Author: Puran
  // Impact: single source of truth for which mode the form is in
  // Reason: every label / handler that branches on create-vs-edit reads
  //         this so the conditionals can never disagree
  const mode: "create" | "edit" = initialProduct === null ? "create" : "edit";
  const isCreate = mode === "create";

  // ── Form state ──────────────────────────────────────────────────────
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [category, setCategory] = useState(initialProduct?.category ?? "Inflatable");
  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [configurable, setConfigurable] = useState(initialProduct?.configurable ?? false);
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status ?? "ACTIVE");
  const [tags, setTags] = useState<string[]>(initialProduct?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Author: Puran
  // Impact: simple toggle handler — Configuration tab is always present
  //         in the bar so we no longer need to redirect away from it
  //         when the user toggles configurable off
  // Reason: previously the tab list was dynamic and we had to bounce
  //         the user back to Basic Info if they were sitting on a tab
  //         that disappeared. With Configuration always-on, the toggle
  //         only flips the inline summary inside the Basic Info card.
  const handleToggleConfigurable = () => {
    setConfigurable((v) => !v);
  };

  // Memoized for the SKU + category subtitle line under the heading.
  const headerSubtitle = useMemo(() => {
    const parts = [sku, category].filter(Boolean);
    return parts.join(" · ");
  }, [sku, category]);

  // ── Action handlers ──────────────────────────────────────────────────

  const handleDiscard = () => {
    router.push("/dashboard/products");
  };

  const handleSave = () => {
    // Author: Puran
    // Impact: mode-aware save handler — different toast + (eventually)
    //         different mutation method
    // Reason: we want to keep the JSX identical but tell the user
    //         what actually happened. Once the API lands this is the
    //         single place to swap toast for useApiMutation; isCreate
    //         decides POST vs PATCH at the same time.
    if (!name.trim()) {
      toast.error("Please enter a product name before saving.");
      return;
    }
    if (isCreate) {
      // TODO(api): useApiMutation('/api/orgs/current/products', 'post')
      toast.success(`"${name}" created.`);
      // After create the user lands back on the list — when the API
      // exists this should navigate to the new product's edit page so
      // they can keep going. For V1 we just go back to the list.
      router.push("/dashboard/products");
    } else {
      // TODO(api): useApiMutation(`/api/orgs/current/products/${initialProduct!.id}`, 'patch')
      toast.success(`"${name}" saved.`);
    }
  };

  const handleAddTag = () => {
    const next = tagDraft.trim();
    if (!next) return;
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) {
      toast.info(`"${next}" is already in the tag list.`);
      return;
    }
    setTags((prev) => [...prev, next]);
    setTagDraft("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  // Author: Puran
  // Impact: header copy + button label change between create and edit
  // Reason: user expects "New product" placeholder + "Create Product"
  //         button when adding, "real name" + "Save Changes" when
  //         editing — same Figma layout, mode-specific copy
  const headingPlaceholder = isCreate ? "New product" : "Untitled product";
  const saveButtonLabel = isCreate ? "Create Product" : "Save Changes";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header row: title + actions ──────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-bold text-slate-900">
            {name || headingPlaceholder}
          </h1>
          {headerSubtitle && (
            <p className="mt-1 text-sm text-slate-500">{headerSubtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusBadge status={status} />
          <StyledSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            wrapperClassName="w-36 sm:w-40"
            aria-label="Product status"
          >
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="NO_PRICE">No Price</option>
            <option value="INACTIVE">Inactive</option>
          </StyledSelect>
          <Button variant="outline" size="md" onClick={handleDiscard}>
            Discard
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            {saveButtonLabel}
          </Button>
        </div>
      </div>

      {/* ── Tab pill bar ──────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Product details sections"
        className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:gap-2"
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-5 h-10 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab body ──────────────────────────────────────────────────── */}
      {activeTab === "basic" ? (
        <>
          {/* Basic Info form card */}
          <Card padding="md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Input
                label="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Big Blue Castle"
              />
              <Input
                label="SKU / Product code"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SKU-001"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Category
                </label>
                <StyledSelect
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Inflatable">Inflatable</option>
                  <option value="Game">Game</option>
                  <option value="Ride">Ride</option>
                  <option value="Other">Other</option>
                </StyledSelect>
              </div>
              <Input
                label="Subcategory (Optional)"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Enter"
              />
            </div>

            {/* Description textarea — full width */}
            <div className="mt-5 flex flex-col gap-1.5">
              <label
                htmlFor="product-description"
                className="text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Brief description shown on quotes and the customer portal."
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-y min-h-25"
              />
            </div>
          </Card>

          {/* Configurable product toggle card */}
          <Card padding="md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Configurable product
                </p>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Turn this on for products that are priced by dimensions or
                  have selectable add-on groups — like marquees, flooring, or
                  AV packages. A Configuration tab will appear to set up
                  pricing rules and add-on options.
                </p>
              </div>
              {/* Switch — same shape language as the toggle in
                  PaymentInvoiceForm so the form family stays uniform. */}
              <button
                type="button"
                role="switch"
                aria-checked={configurable}
                onClick={handleToggleConfigurable}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/50",
                  configurable ? "bg-[#1a2f6e]" : "bg-gray-200",
                ].join(" ")}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    configurable ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>

            {/* Configuration summary chip row — only when toggle on. */}
            {configurable && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Configuration summary
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SummaryChip variant="primary">
                    Dimension-based pricing
                  </SummaryChip>
                  <SummaryChip>Sidewalls · 2 options</SummaryChip>
                  <SummaryChip>Flooring · 3 options</SummaryChip>
                  <SummaryChip>Lighting · 3 options</SummaryChip>
                  <SummaryChip>Chairs &amp; Tables · 2 options</SummaryChip>
                </div>
              </div>
            )}
          </Card>

          {/* Product images card */}
          <Card padding="md">
            <p className="text-sm font-semibold text-slate-900">
              Product images
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              First image is used as the primary photo on quotes and the
              customer portal.
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="aspect-square rounded-2xl bg-slate-100 border border-slate-200"
                  aria-label={`Product image ${idx + 1}`}
                />
              ))}
              <button
                type="button"
                onClick={() => toast.info("Image upload — coming soon.")}
                className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600 flex items-center justify-center"
                aria-label="Add image"
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
            </div>
          </Card>

          {/* Tags card */}
          <Card padding="md">
            <p className="text-sm font-semibold text-slate-900">Tags</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 transition-colors hover:text-slate-700"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              ))}
              {/* Add Tag pill — outlined blue, opens an inline input.
                  Submitting on Enter (in the input) or clicking the +
                  button commits the tag. */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1a2f6e]/40 bg-[#1a2f6e]/5 pl-3 pr-1 py-1">
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add Tag"
                  aria-label="New tag"
                  className="w-20 sm:w-24 bg-transparent text-xs font-medium text-[#1a2f6e] placeholder:text-[#1a2f6e]/60 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/10"
                  aria-label="Add tag"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Card>
        </>
      ) : activeTab === "pricing" ? (
        <PricingTab />
      ) : activeTab === "inventory" ? (
        <InventoryTab />
      ) : activeTab === "operational" ? (
        <OperationalTab />
      ) : activeTab === "warehouse" ? (
        <WarehouseTab />
      ) : activeTab === "notes" ? (
        <NotesRulesTab />
      ) : activeTab === "configuration" ? (
        <ConfigurationTab />
      ) : (
        <ComingSoonTab
          tabLabel={TABS.find((t) => t.id === activeTab)?.label ?? ""}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

/**
 * Status pill rendered next to the dropdown — visual confirmation of
 * the currently selected status. Same outlined-pill language as the
 * list page so a user moving between the two screens recognises it
 * instantly.
 */
function StatusBadge({ status }: { status: ProductStatus }) {
  const variantClass =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "MAINTENANCE"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "NO_PRICE"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  const label =
    status === "ACTIVE"
      ? "Active"
      : status === "MAINTENANCE"
      ? "Maintenance"
      : status === "NO_PRICE"
      ? "No Price"
      : "Inactive";

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${variantClass}`}
    >
      {label}
    </span>
  );
}

/**
 * Configuration summary chip — two visual variants:
 *   - `primary`: highlighted (blue outline + light blue bg + blue
 *     text). Used for the configuration "type" indicator like
 *     "Dimension-based pricing" so it visually anchors the row.
 *   - `default`: slate outline + white bg, used for individual
 *     option groups like "Sidewalls · 2 options".
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */
function SummaryChip({
  variant = "default",
  children,
}: {
  variant?: "primary" | "default";
  children: React.ReactNode;
}) {
  const variantClass =
    variant === "primary"
      ? "border-[#1a2f6e]/40 bg-[#1a2f6e]/5 text-[#1a2f6e]"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${variantClass}`}
    >
      {children}
    </span>
  );
}

/**
 * Small gear / cog icon used as the leading mark on the Configuration
 * tab. Heroicons-style outline.
 */
function CogIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

/**
 * Placeholder card shown for tabs that don't have content yet. Tells
 * the user the section is intentionally empty (not broken) and will
 * land soon.
 */
function ComingSoonTab({ tabLabel }: { tabLabel: string }) {
  return (
    <Card padding="lg">
      <div className="py-6 sm:py-10 text-center">
        <p className="text-sm font-semibold text-slate-900">
          {tabLabel} — coming soon
        </p>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          This section is part of the Module A roadmap and will be wired
          up in a follow-up release.
        </p>
      </div>
    </Card>
  );
}
