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
 *      - Conditional rules  (IF/THEN rule cards — client state until API)
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
import { Card } from "@/components/ui/Card";
import {
  ConditionalRulesPanel,
  emptyConditionalRule,
  INITIAL_CONDITIONAL_RULES,
} from "@/components/products/ConditionalRulesPanel";
import { SimulatePanel } from "@/components/products/SimulatePanel";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type {
  AccessoryRow,
  ComponentRow,
  ProductType,
} from "@/types/products";

// Author: Puran
// Impact: Inventory tab is now a fully controlled component — all
//         state owned by ProductEditorForm and passed as props
// Reason: quantity, components, and accessories must persist through
//         the parent form's buildPayload → API. Mock local state
//         was silently dropping all inventory changes on save.
export interface InventoryTabProps {
  productType: ProductType;
  // Stock levels
  quantity: string;
  onChangeQuantity: (v: string) => void;
  // Component parts (base loading list)
  components: ComponentRow[];
  onChangeComponents: (next: ComponentRow[]) => void;
  // Accessories & consumables
  accessories: AccessoryRow[];
  onChangeAccessories: (next: AccessoryRow[]) => void;
}

// ─── Types ─────────────────────────────────────────────────────────────

type SubTabId = "base" | "conditional" | "simulate";

interface SubTabConfig {
  id: SubTabId;
  label: string;
}

const SUB_TABS: SubTabConfig[] = [
  { id: "base", label: "Base components" },
  { id: "conditional", label: "Conditional rules" },
  { id: "simulate", label: "Simulate" },
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
 * Renders the full Inventory tab as a controlled component. All state
 * is owned by ProductEditorForm and passed as props.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Inventory tab)
 */
export function InventoryTab(props: InventoryTabProps) {
  const {
    productType,
    quantity: totalQuantity,
    onChangeQuantity,
    components,
    onChangeComponents,
    accessories,
    onChangeAccessories,
  } = props;

  const isSizeVariant = productType === "SIZE_VARIANT";

  // ── Sub-tab navigation (local — UI-only, not persisted) ────────────
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("base");
  const [trackingMode, setTrackingMode] = useState("quantity_only");

  // ── Conditional rules (Component parts → Conditional rules sub-tab) ─
  const [conditionalRules, setConditionalRules] = useState(
    () => INITIAL_CONDITIONAL_RULES,
  );

  // ── Component CRUD helpers ───────────────────────────────────────────
  // Author: Puran
  // Impact: component row mutations operate on the lifted props
  // Reason: parent owns the state — these handlers call
  //         onChangeComponents to propagate changes up
  const handleRowChange = (
    idx: number,
    field: keyof ComponentRow,
    value: string | number,
  ) => {
    const updated = [...components];
    updated[idx] = { ...updated[idx], [field]: value };
    onChangeComponents(updated);
  };

  const handleRemoveRow = (idx: number) => {
    if (components.length === 1) {
      toast.info("At least one component is required.");
      return;
    }
    onChangeComponents(components.filter((_, i) => i !== idx));
  };

  const handleAddRow = () => {
    onChangeComponents([
      ...components,
      { name: "", quantity: 1, qtyFormula: "fixed", warehouseNote: "" },
    ]);
  };

  // ── Accessories handlers ────────────────────────────────────────────
  // Author: Puran
  // Impact: accessory mutations operate on the lifted props
  // Reason: parent owns the state
  const handleAccessoryChange = (
    idx: number,
    field: keyof AccessoryRow,
    value: string,
  ) => {
    const updated = [...accessories];
    updated[idx] = { ...updated[idx], [field]: value } as AccessoryRow;
    onChangeAccessories(updated);
  };

  const handleRemoveAccessory = (idx: number) => {
    onChangeAccessories(accessories.filter((_, i) => i !== idx));
  };

  const handleAddAccessory = () => {
    onChangeAccessories([
      ...accessories,
      { name: "", requirement: "always" },
    ]);
  };

  const handleCreateNewRule = () => {
    if (activeSubTab === "conditional") {
      setConditionalRules((prev) => [...prev, emptyConditionalRule()]);
      return;
    }
    toast.info("Create New Rule — switch to the Conditional rules tab.");
  };

  return (
    <div className="space-y-6">
      {/* ── Stock levels card — Figma: bold section title, two-column grid ─ */}
      <Card padding="md" className="rounded-2xl border-slate-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Stock levels</h3>

        {isSizeVariant ? (
          <div className="mt-5 rounded-2xl border border-blue bg-blue-50 px-4 py-3.5">
            <p className="text-sm text-blue leading-relaxed">
              <strong>Per-variant inventory:</strong> this product tracks stock
              per size variant. Set the quantity for each size on the{" "}
              <strong>Configuration</strong> tab under <em>Size options</em>. The
              total stock is the sum of every active variant.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-y-5 md:grid-cols-2 md:gap-x-10 md:gap-y-4">
            <div>
              <Input
                label="Total quantity owned *"
                value={totalQuantity}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  onChangeQuantity(cleaned);
                }}
                placeholder="0"
                inputMode="numeric"
                inputClassName="text-base"
              />
              <p className="mt-2 text-sm text-slate-500">
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
                  className="text-base"
                >
                  <option value="quantity_only">Quantity only (V1)</option>
                  <option value="serial">Serial / Asset tag (V2)</option>
                </StyledSelect>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Individual unit tracking in Module B
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Component parts header + sub-tabs always in card ─────────── */}
      <Card padding="md" className="rounded-2xl border-slate-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Component parts</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Base list for standard conditions. Rules below adjust what goes on the
          truck based on surface, duration, job type and more.
        </p>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Component parts sub-sections"
            className="-mx-1 flex flex-wrap items-center gap-2 px-1"
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
                    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors",
                    active
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
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
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-[#042E93] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#042E93]/90"
            >
              Create New Rule
            </button>
          </div>
        </div>

        {/* Base components and Conditional rules render inside the card */}
        {activeSubTab !== "simulate" && (
          <div className="mt-5">
            {activeSubTab === "conditional" ? (
              <ConditionalRulesPanel
                rules={conditionalRules}
                onRulesChange={setConditionalRules}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <InfoBanner text={INFO_BANNER_COPY[activeSubTab]} />
                <BaseComponentsList
                  rows={components}
                  onChange={handleRowChange}
                  onRemove={handleRemoveRow}
                  onAdd={handleAddRow}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Simulate renders as its own top-level cards (no outer card wrapper) */}
      {activeSubTab === "simulate" && (
        <SimulatePanel
          baseRows={components.map((c, i) => ({
            id: `comp-${i}`,
            name: c.name,
            quantity: String(c.quantity),
            qtyFormula: c.qtyFormula,
          }))}
          conditionalRules={conditionalRules}
        />
      )}

      {/* ── Accessories — hidden on Simulate sub-tab (not relevant there) ─── */}
      {activeSubTab !== "simulate" && <Card padding="md" className="rounded-2xl border-slate-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Accessories &amp; consumables required
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Items that must go with this product but are tracked separately.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {accessories.map((acc, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <Input
                    value={acc.name}
                    onChange={(e) =>
                      handleAccessoryChange(idx, "name", e.target.value)
                    }
                    placeholder="Component name"
                    inputClassName="text-base"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:w-[min(100%,220px)]">
                  <StyledSelect
                    value={acc.requirement}
                    onChange={(e) =>
                      handleAccessoryChange(
                        idx,
                        "requirement",
                        e.target.value,
                      )
                    }
                    aria-label="Requirement"
                    className="text-base"
                  >
                    <option value="always">Always required</option>
                    <option value="optional">Optional</option>
                    <option value="conditional">Conditional</option>
                  </StyledSelect>
                  <RemoveButton
                    onClick={() => handleRemoveAccessory(idx)}
                    label={`Remove accessory ${acc.name || "untitled"}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-4 py-4">
            <button
              type="button"
              onClick={handleAddAccessory}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
            >
              <PlusIcon />
              Add accessory
            </button>
          </div>
        </div>
      </Card>}
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
        <p className="text-sm leading-relaxed text-blue">{text}</p>
      </div>
    </div>
  );
}

interface BaseComponentsListProps {
  rows: ComponentRow[];
  onChange: (idx: number, field: keyof ComponentRow, value: string | number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
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
  onAdd,
}: BaseComponentsListProps) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Desktop column headers — aligned to row grid */}
        <div className="hidden lg:grid lg:grid-cols-[28px_minmax(0,2fr)_88px_minmax(140px,1fr)_minmax(0,1.5fr)_48px] lg:items-end lg:gap-3 lg:border-b lg:border-slate-100 lg:px-5 lg:pb-3 lg:pt-4">
          <span className="sr-only">Drag</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Component name
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Qty
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Qty formula
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Warehouse note
          </p>
          <span className="sr-only">Remove</span>
        </div>

        <div className="flex flex-col divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid lg:grid-cols-[28px_minmax(0,2fr)_88px_minmax(140px,1fr)_minmax(0,1.5fr)_48px] lg:items-center lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-4"
            >
          {/* Drag handle — visual only, hidden below lg */}
          <div className="hidden lg:flex lg:items-center lg:justify-center text-slate-400">
            <DragHandleIcon />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 lg:block">
              <label className="text-sm font-medium text-slate-700 lg:hidden">
                Component name
              </label>
              <div className="lg:hidden">
                <RemoveButton
                  onClick={() => onRemove(idx)}
                  label={`Remove component ${row.name || "untitled"}`}
                />
              </div>
            </div>
            <Input
              value={row.name}
              onChange={(e) => onChange(idx, "name", e.target.value)}
              placeholder="Component name"
              inputClassName="text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 lg:hidden">
              Qty
            </label>
            <Input
              value={String(row.quantity)}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                onChange(idx, "quantity", parseInt(cleaned, 10) || 0);
              }}
              placeholder="1"
              inputMode="numeric"
              inputClassName="text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 lg:hidden">
              Qty formula
            </label>
            <StyledSelect
              value={row.qtyFormula ?? "fixed"}
              onChange={(e) => onChange(idx, "qtyFormula", e.target.value)}
              aria-label={`Qty formula for ${row.name || "component"}`}
              className="text-base"
            >
              {Object.entries(QTY_FORMULA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </StyledSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 lg:hidden">
              Warehouse note
            </label>
            <Input
              value={row.warehouseNote ?? ""}
              onChange={(e) =>
                onChange(idx, "warehouseNote", e.target.value)
              }
              placeholder="Warehouse note..."
              inputClassName="text-base"
            />
          </div>
          {/* Desktop-only delete column — mobile delete lives next to the
              Component name label above. */}
          <div className="hidden lg:flex lg:justify-center lg:items-center">
            <RemoveButton
              onClick={() => onRemove(idx)}
              label={`Remove component ${row.name || "untitled"}`}
            />
          </div>
            </div>
          ))}
        </div>

        {/* "+ Add component" button inside the bordered card */}
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
          >
            <PlusIcon />
            Add component
          </button>
        </div>
      </div>
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
