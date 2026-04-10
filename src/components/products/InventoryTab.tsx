"use client";

/**
 * InventoryTab — third tab of the Product Details / Edit screen.
 *
 * Layout (top → bottom):
 *   1. Stock levels card — total qty owned + unit-level tracking
 *      mode (V1 only supports "Quantity only").
 *   2. Component parts card — section header + sub-tab pill bar:
 *      - Concrete           (simple component list)
 *      - Grass              (simple component list)
 *      - Base components    (rich component list with qty formula
 *                            and warehouse note per row)
 *      - Conditional rules  (placeholder for V1)
 *      - Simulate           (placeholder for V1)
 *      Each sub-tab has its own component list state so toggling
 *      between tabs preserves edits in both directions. The Create
 *      New Rule button lives at the right of the sub-tab row and
 *      stubs to a toast for V1.
 *   3. Accessories & consumables required card — separate flat list
 *      with name + requirement select + delete per row.
 *
 * Backend status: same as Pricing tab — entirely client state for V1.
 * When the API lands the parent ProductEditorForm will lift state via
 * props + onChange, and the Create New Rule button will open a real
 * modal that POSTs to /api/orgs/current/products/:id/rules.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Inventory tab)
 */

// Author: Puran
// Impact: new dedicated component for the Inventory tab — extracted
//         alongside PricingTab so ProductEditorForm doesn't balloon
// Reason: this tab has its own sub-tab navigation + multiple lists +
//         conditional row layouts. Belongs in its own file for the
//         same reason PricingTab does.

import { useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type { ProductType } from "@/types/products";

// Author: Puran
// Impact: Inventory tab now accepts the parent product's productType
//         so the Stock levels card can hide the parent qty input for
//         SIZE_VARIANT products (per Q2 sign-off — variant qty is
//         the source of truth for size variants)
// Reason: Configurable Product Pricing spec §3 — for size_variant
//         products, inventory is tracked PER VARIANT in the
//         product_variants table. The parent quantity column is
//         unused. Hiding it cleanly prevents the user from entering
//         a contradictory number.
export interface InventoryTabProps {
  productType: ProductType;
}

// ─── Types ─────────────────────────────────────────────────────────────

type SubTabId = "base" | "conditional" | "simulate";

interface SubTabConfig {
  id: SubTabId;
  label: string;
}

interface ComponentRow {
  id: string;
  name: string;
  /** Whole number string so the input can hold partial values */
  quantity: string;
  /** Only used by the "base" sub-tab */
  qtyFormula?: string;
  /** Only used by the "base" sub-tab */
  warehouseNote?: string;
}

interface AccessoryRow {
  id: string;
  name: string;
  requirement: "always" | "optional" | "conditional";
}

const SUB_TABS: SubTabConfig[] = [
  { id: "base", label: "Base components" },
  { id: "conditional", label: "Conditional rules" },
  { id: "simulate", label: "Simulate" },
];

// ─── Mock seeds ────────────────────────────────────────────────────────

const INITIAL_BASE: ComponentRow[] = [
  {
    id: "b1",
    name: "Castle body (blue/white)",
    quantity: "1",
    qtyFormula: "fixed",
    warehouseNote: "",
  },
  {
    id: "b2",
    name: "Blower (1.1kW)",
    quantity: "1",
    qtyFormula: "fixed",
    warehouseNote: "Store on top of castle roll",
  },
  {
    id: "b3",
    name: "Steel pegs",
    quantity: "6",
    qtyFormula: "fixed",
    warehouseNote: "Standard grass anchoring",
  },
  {
    id: "b4",
    name: "Hammer",
    quantity: "1",
    qtyFormula: "per_crew",
    warehouseNote: "1 per crew member",
  },
  {
    id: "b5",
    name: "Repair kit",
    quantity: "1",
    qtyFormula: "fixed",
    warehouseNote: "Always in cab bag",
  },
];

const INITIAL_ACCESSORIES: AccessoryRow[] = [
  { id: "a1", name: "Extension lead (20m)", requirement: "always" },
  { id: "a2", name: "Repair kit", requirement: "always" },
];

// Friendly labels for the qty formula select.
const QTY_FORMULA_LABELS: Record<string, string> = {
  fixed: "Fixed qty",
  per_crew: "Per crew",
  per_hour: "Per hour",
  per_day: "Per day",
};

// Info banner copy keyed by sub-tab — kept here so the component body
// stays focused on layout.
const INFO_BANNER_COPY: Record<SubTabId, string> = {
  base: "List the parts that make up this product. This is the default loading list. Conditional rules below override it based on surface type, job duration, structure type, and more.",
  conditional: "",
  simulate: "",
};

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Inventory tab. State is owned locally for V1; lift
 * to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Inventory tab)
 */
export function InventoryTab({ productType }: InventoryTabProps) {
  // ── Stock levels state ──────────────────────────────────────────────
  const [totalQuantity, setTotalQuantity] = useState("2");
  const [trackingMode, setTrackingMode] = useState("quantity_only");
  const isSizeVariant = productType === "SIZE_VARIANT";

  // ── Sub-tab navigation ──────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("base");

  // ── Component list ─────────────────────────────────────────────────
  const [baseRows, setBaseRows] = useState<ComponentRow[]>(INITIAL_BASE);

  // ── Accessories ─────────────────────────────────────────────────────
  const [accessories, setAccessories] = useState<AccessoryRow[]>(INITIAL_ACCESSORIES);

  // ── Helpers to update the active list ───────────────────────────────
  // Author: Puran
  // Impact: single dispatcher for component-row mutations
  // Reason: each sub-tab has its own state slice but the row CRUD is
  //         identical, so a tiny dispatcher avoids three near-identical
  //         pairs of handlers and keeps the JSX readable
  const getActiveList = (): {
    rows: ComponentRow[];
    setRows: (next: ComponentRow[]) => void;
  } => {
    return { rows: baseRows, setRows: setBaseRows };
  };

  const handleRowChange = (
    id: string,
    field: keyof ComponentRow,
    value: string,
  ) => {
    const { rows, setRows } = getActiveList();
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleRemoveRow = (id: string) => {
    const { rows, setRows } = getActiveList();
    if (rows.length === 1) {
      toast.info("At least one component is required.");
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleAddRow = () => {
    const { rows, setRows } = getActiveList();
    const id = `row-${Date.now().toString(36)}`;
    const newRow: ComponentRow =
      activeSubTab === "base"
        ? {
            id,
            name: "",
            quantity: "1",
            qtyFormula: "fixed",
            warehouseNote: "",
          }
        : { id, name: "", quantity: "1" };
    setRows([...rows, newRow]);
  };

  // ── Accessories handlers ────────────────────────────────────────────

  const handleAccessoryChange = (
    id: string,
    field: keyof AccessoryRow,
    value: string,
  ) => {
    setAccessories((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );
  };

  const handleRemoveAccessory = (id: string) => {
    setAccessories((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddAccessory = () => {
    setAccessories((prev) => [
      ...prev,
      {
        id: `acc-${Date.now().toString(36)}`,
        name: "",
        requirement: "always",
      },
    ]);
  };

  const handleCreateNewRule = () => {
    toast.info("Create New Rule — coming soon.");
  };

  return (
    <div className="space-y-4">
      {/* ── Stock levels card ────────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Stock levels</p>

        {isSizeVariant ? (
          // Author: Puran
          // Impact: SIZE_VARIANT products hide the parent quantity
          //         input entirely; inventory lives per-variant
          // Reason: Q2 sign-off — variant qty is the source of truth
          //         for size variants. The Configuration tab's
          //         Size options card is where the per-variant
          //         quantity gets entered.
          <div className="mt-4 rounded-2xl border border-blue bg-blue-50 px-4 py-3">
            <p className="text-xs sm:text-sm text-blue leading-relaxed">
              <strong>Per-variant inventory:</strong> this product
              tracks stock per size variant. Set the quantity for each
              size on the <strong>Configuration</strong> tab under{" "}
              <em>Size options</em>. The total stock is the sum of
              every active variant.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Input
                label="Total quantity owned *"
                value={totalQuantity}
                onChange={(e) => {
                  // Strip non-digits so the input always holds a clean number
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setTotalQuantity(cleaned);
                }}
                placeholder="0"
                inputMode="numeric"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Total units available for hire
              </p>
            </div>
            <div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Unit-level tracking
                </label>
                <StyledSelect
                  value={trackingMode}
                  onChange={(e) => setTrackingMode(e.target.value)}
                  aria-label="Unit-level tracking mode"
                >
                  <option value="quantity_only">Quantity only (V1)</option>
                  <option value="serial">Serial / Asset tag (V2)</option>
                </StyledSelect>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Individual unit tracking in Module B
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Component parts card ─────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Component parts</p>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Base list for standard conditions. Rules below adjust what goes on
          the truck based on surface, duration, job type and more.
        </p>

        {/* Sub-tab pill bar + Create New Rule button.
            Stacks on small screens so the rule button doesn't push the
            tabs off the right edge. */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Component parts sub-sections"
            className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:gap-2"
          >
            {SUB_TABS.map((tab) => {
              const active = tab.id === activeSubTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={[
                    "shrink-0 inline-flex items-center justify-center rounded-full px-4 h-9 text-xs font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleCreateNewRule}
              className="inline-flex items-center justify-center rounded-full bg-[#042E93] px-5 h-10 text-xs font-semibold text-white transition-colors hover:bg-[#042E93]/90 cursor-pointer"
            >
              Create New Rule
            </button>
          </div>
        </div>

        {/* Sub-tab body */}
        <div className="mt-4">
          {activeSubTab === "conditional" || activeSubTab === "simulate" ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {activeSubTab === "conditional"
                  ? "Conditional rules"
                  : "Simulate"}{" "}
                — coming soon
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                This section is part of the Module A roadmap and will be
                wired up in a follow-up release.
              </p>
            </div>
          ) : (
            <>
              <InfoBanner text={INFO_BANNER_COPY[activeSubTab]} />

              <BaseComponentsList
                rows={baseRows}
                onChange={handleRowChange}
                onRemove={handleRemoveRow}
              />

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
                >
                  <PlusIcon />
                  Add component
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Accessories & consumables card ───────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Accessories &amp; consumables required
        </p>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Items that must go with this product but are tracked separately.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {accessories.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_minmax(180px,200px)_auto] gap-2 md:gap-3 md:items-center"
            >
              <Input
                value={acc.name}
                onChange={(e) =>
                  handleAccessoryChange(acc.id, "name", e.target.value)
                }
                placeholder="Component name"
              />
              <StyledSelect
                value={acc.requirement}
                onChange={(e) =>
                  handleAccessoryChange(acc.id, "requirement", e.target.value)
                }
                aria-label="Requirement"
              >
                <option value="always">Always required</option>
                <option value="optional">Optional</option>
                <option value="conditional">Conditional</option>
              </StyledSelect>
              <div className="flex justify-end md:justify-center md:items-center">
                <RemoveButton
                  onClick={() => handleRemoveAccessory(acc.id)}
                  label={`Remove accessory ${acc.name || "untitled"}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleAddAccessory}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
          >
            <PlusIcon />
            Add accessory
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface InfoBannerProps {
  text: string;
}

/**
 * Info banner — brand-blue border + bg + icon + text. Shell uses the
 * brand `blue` token (#0062FF) for the solid border, Tailwind's
 * blue-50 for the lighter fill. Same visual treatment used by the
 * Warehouse and Notes & Rules tabs so the form palette stays uniform.
 *
 * Old Author: Puran
 * New Author: Puran
 * Impact: bumped border from blue-300 → solid brand blue
 * Reason: Figma shows the full brand `#0062FF` as the border, not
 *         the lighter blue-300 tint. blue-300 was too pale to read
 *         against the card background — the solid brand-blue border
 *         matches the screenshot exactly and reads as a clear
 *         "notification" surface.
 */
function InfoBanner({ text }: InfoBannerProps) {
  return (
    <div className="rounded-2xl border border-blue bg-blue-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-blue"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p className="text-xs sm:text-sm text-blue leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

interface BaseComponentsListProps {
  rows: ComponentRow[];
  onChange: (id: string, field: keyof ComponentRow, value: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Base components sub-tab list — drag handle + name + qty + qty
 * formula select + warehouse note + delete.
 *
 * Desktop (lg+): full row with all 5 fields visible in a 6-column grid.
 * Below lg: drag handle hidden, fields stack vertically with their
 * own labels (same mobile-card pattern as PricingTab tier rows).
 *
 * Author: Puran
 * Impact: switched the desktop breakpoint from md → lg
 * Reason: at md (768px) the 6-column grid squeezed the "Component
 *         name" + "Qty" headers into each other because the 1.4fr +
 *         1.2fr columns shrank too far. The grid needs at least
 *         ~1024px of horizontal room to render comfortably with
 *         sidebar + page padding eaten in. Below lg, the stacked
 *         mobile layout is correct anyway.
 *
 * Note: drag handle is visual only for V1 — wiring up drag-to-reorder
 * needs a sortable library and is its own scope.
 */
function BaseComponentsList({
  rows,
  onChange,
  onRemove,
}: BaseComponentsListProps) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* Desktop column headers — only at lg+ where the 6-col grid fits */}
      <div className="hidden lg:grid grid-cols-[20px_1.4fr_80px_140px_1.2fr_auto] gap-3 px-1">
        <span className="sr-only">Drag</span>
        <p className="text-xs font-semibold text-slate-600">Component name</p>
        <p className="text-xs font-semibold text-slate-600">Qty</p>
        <p className="text-xs font-semibold text-slate-600">Qty formula</p>
        <p className="text-xs font-semibold text-slate-600">Warehouse note</p>
        <span className="sr-only">Remove</span>
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          // Author: Puran
          // Impact: mobile wraps each row in a slate-50 card so the
          //         × delete button has a clear visual boundary
          // Reason: same fix as the Configuration tab option rows —
          //         floating the delete at the bottom of the stacked
          //         block looked disconnected from its row. The card
          //         disappears at lg+ where the inline grid takes over.
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid lg:grid-cols-[20px_1.4fr_80px_140px_1.2fr_auto] lg:gap-3 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
        >
          {/* Drag handle — visual only, hidden below lg */}
          <div className="hidden lg:flex lg:items-center lg:justify-center text-slate-400">
            <DragHandleIcon />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 lg:block">
              <label className="lg:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
                Component name
              </label>
              <div className="lg:hidden">
                <RemoveButton
                  onClick={() => onRemove(row.id)}
                  label={`Remove component ${row.name || "untitled"}`}
                />
              </div>
            </div>
            <Input
              value={row.name}
              onChange={(e) => onChange(row.id, "name", e.target.value)}
              placeholder="Component name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="lg:hidden text-xs font-medium text-slate-500">
              Qty
            </label>
            <Input
              value={row.quantity}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                onChange(row.id, "quantity", cleaned);
              }}
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="lg:hidden text-xs font-medium text-slate-500">
              Qty formula
            </label>
            <StyledSelect
              value={row.qtyFormula ?? "fixed"}
              onChange={(e) => onChange(row.id, "qtyFormula", e.target.value)}
              aria-label={`Qty formula for ${row.name || "component"}`}
            >
              {Object.entries(QTY_FORMULA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </StyledSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="lg:hidden text-xs font-medium text-slate-500">
              Warehouse note
            </label>
            <Input
              value={row.warehouseNote ?? ""}
              onChange={(e) =>
                onChange(row.id, "warehouseNote", e.target.value)
              }
              placeholder="Warehouse note..."
            />
          </div>
          {/* Desktop-only delete column — mobile delete lives next to the
              Component name label above. */}
          <div className="hidden lg:flex lg:justify-center lg:items-center">
            <RemoveButton
              onClick={() => onRemove(row.id)}
              label={`Remove component ${row.name || "untitled"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface RemoveButtonProps {
  onClick: () => void;
  label: string;
}

/**
 * Outlined navy circular delete button — solid `#1a2f6e` border with
 * a SLATE × icon inside. Same shape as the Pricing tab tier-row
 * delete and the Configuration tab option-row delete so the form
 * family stays uniform.
 *
 * Old Author: Puran
 * New Author: Puran
 * Impact: × icon stroke is slate-700 (not navy) so it visually
 *         contrasts with the navy border circle
 * Reason: Figma shows the × icon as a softer slate stroke against
 *         the strong navy border ring. Having both at full navy
 *         made the icon blend into the border and read as a
 *         single dark blob instead of "ring + glyph".
 */
function RemoveButton({ onClick, label }: RemoveButtonProps) {
  return (
    // Author: Puran
    // Impact: bumped circle from h-9 w-9 (36px) → h-11 w-11 (44px),
    //         icon from h-4 → h-5, stroke from 2.5 → 2 (cleaner at
    //         the larger size)
    // Reason: Figma shows the × circles closer to ~44px with a
    //         slightly thinner stroke. The smaller h-9 size made
    //         them look cramped next to the h-12 input pills in
    //         the same row.
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1a2f6e] text-slate-700 transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer"
      aria-label={label}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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
  );
}

/**
 * 2×3 dot-grip drag handle. Visual only for V1; the sortable wiring
 * lands when drag-to-reorder becomes a real feature.
 */
function DragHandleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}
