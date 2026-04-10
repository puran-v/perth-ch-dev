"use client";

/**
 * ConfigurationTab — fully controlled component owned by
 * `ProductEditorForm`. Phase 2 refactor of the Configurable Product
 * Pricing rollout.
 *
 * Layout (top → bottom):
 *   1. Top info banner explaining the configurator concept.
 *   2. Product type card — 3 large selectable cards (Dimension-based,
 *      Size variants, Quantity + add-ons). The standard product type
 *      from the spec (§2) is also a valid value but the form treats
 *      "no configuration needed" as the default and only exposes the
 *      three configurable models in the picker — STANDARD products
 *      simply skip this tab.
 *   3. Dimension inputs card — labels for the two dimension axes,
 *      shared min/max range, step size, default dimensions.
 *   4. Base pricing formula card — pricing method, rate (in dollars,
 *      converted to cents at the network boundary), min area, min
 *      price + a live "Pricing preview" sub-section computed via
 *      the shared `computeDimensionPreview` helper.
 *   5. Size options card — variants list (only shown when productType
 *      === SIZE_VARIANT). In create mode, replaced with a "save the
 *      product first" empty state because variants need a parent id.
 *   6. Add-on groups card — N groups with N options each, attachable
 *      to ANY product type per §6 of the spec.
 *   7. Configuration notes — currently surfaced via the AI rules
 *      field on the Notes & Rules tab; not duplicated here.
 *
 * Backend status: WIRED. Every field reads from props supplied by
 * `ProductEditorForm`, which lifts all state to the parent and
 * sends it through `useCreateProduct` / `useUpdateProduct` (parent)
 * and `useCreateVariant` / `useUpdateVariant` / `useDeleteVariant`
 * (children) per the Phase 2 sign-off — parent first, children
 * second, errors collected per-row without auto-rollback.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Configuration tab)
 */

// Old Author: Puran
// New Author: Puran
// Impact: refactored from local-state component into a fully
//         controlled component owned by ProductEditorForm
// Reason: Phase 2 of the Configurable Product Pricing rollout —
//         parent owns all state so the persistence flow can roll
//         it into the same save bundle as Basic Info / Operational
//         / Warehouse. The legacy local types (`dimension`/`size`
//         /`qty`) are gone — every consumer now uses the canonical
//         backend `ProductType` enum.

import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type {
  AddonGroup,
  AddonOption,
  AddonPricingUnit,
  AddonSelectionType,
  PricingMethod,
  ProductType,
} from "@/types/products";
import type { DimensionPreviewCell } from "@/lib/products/pricing";

// ─── Constants ─────────────────────────────────────────────────────────

const UNIT_LABELS: Record<AddonPricingUnit, string> = {
  flat: "Flat",
  per_unit: "Per Unit",
  per_bay: "Per Bay",
  per_sqm: "Per Sqm",
};

const SELECTION_MODE_LABELS: Record<AddonSelectionType, string> = {
  any: "Select Any",
  single: "Select One",
  required_single: "Required",
};

interface ProductTypeConfig {
  /** Backend enum literal */
  id: ProductType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ─── Props ─────────────────────────────────────────────────────────────

/**
 * Variant draft as held by the parent form's `variants` state.
 * `id === null` means "newly added in this edit session, will be
 * POSTed on save"; `id !== null` means "existing DB row, will be
 * PATCHed on save". Numeric fields are display strings so the
 * inputs can be cleared without flipping to NaN.
 */
export interface VariantDraft {
  key: string;
  id: string | null;
  label: string;
  description: string;
  priceDay: string;
  priceHalfday: string;
  priceOvernight: string;
  quantity: string;
  skuSuffix: string;
  sortOrder: number;
  active: boolean;
}

/**
 * One row in the flat-tier pricing table. All numeric fields are
 * held as display strings so the inputs can be cleared without
 * flipping to NaN — same convention as VariantDraft.
 *
 * @author Puran
 * @created 2026-04-10
 * @module Module A - Products (Configuration tab)
 */
export interface TierDraft {
  key: string;
  areaFrom: string;
  areaTo: string;
  price: string;
}

export interface ConfigurationTabProps {
  /** Are we in create mode (no parent id yet)? Disables variants. */
  isCreate: boolean;

  // ── Product type ─────────────────────────────────────────────────
  productType: ProductType;
  onChangeProductType: (next: ProductType) => void;

  // ── Dimension inputs (DIMENSION_BASED only) ──────────────────────
  dim1Label: string;
  onChangeDim1Label: (v: string) => void;
  dim2Label: string;
  onChangeDim2Label: (v: string) => void;
  dimMin: string;
  onChangeDimMin: (v: string) => void;
  dimMax: string;
  onChangeDimMax: (v: string) => void;
  dimStep: string;
  onChangeDimStep: (v: string) => void;
  dimDefault1: string;
  onChangeDimDefault1: (v: string) => void;
  dimDefault2: string;
  onChangeDimDefault2: (v: string) => void;

  // ── Base pricing formula (DIMENSION_BASED only) ──────────────────
  pricingMethod: PricingMethod;
  onChangePricingMethod: (v: PricingMethod) => void;
  // per_sqm cluster
  /** User-facing dollar string (e.g. "5.50"). Cents conversion
   *  happens in the parent's `buildPricingConfig`. */
  ratePerSqmDollars: string;
  onChangeRatePerSqmDollars: (v: string) => void;
  minArea: string;
  onChangeMinArea: (v: string) => void;
  minPrice: string;
  onChangeMinPrice: (v: string) => void;
  // base_plus_sqm cluster
  basePrice: string;
  onChangeBasePrice: (v: string) => void;
  overheadRateDollars: string;
  onChangeOverheadRateDollars: (v: string) => void;
  // flat_tier cluster
  pricingTiers: TierDraft[];
  onAddTier: () => void;
  onChangeTier: (key: string, patch: Partial<TierDraft>) => void;
  onRemoveTier: (key: string) => void;

  /** Live pricing preview cells, computed in the parent via the
   *  shared `computeDimensionPreview` helper. */
  pricingPreview: DimensionPreviewCell[];

  // ── Size variants (SIZE_VARIANT only) ────────────────────────────
  variants: VariantDraft[];
  onAddVariant: () => void;
  onChangeVariant: (key: string, patch: Partial<VariantDraft>) => void;
  onRemoveVariant: (key: string) => void;

  // ── Add-on groups (any product type) ─────────────────────────────
  addonGroups: AddonGroup[];
  onAddAddonGroup: () => void;
  onChangeAddonGroup: (groupId: string, patch: Partial<AddonGroup>) => void;
  onRemoveAddonGroup: (groupId: string) => void;
  onAddAddonOption: (groupId: string) => void;
  onChangeAddonOption: (
    groupId: string,
    optionId: string,
    patch: Partial<AddonOption>
  ) => void;
  onRemoveAddonOption: (groupId: string, optionId: string) => void;

  // ── Configuration notes ─────────────────────────────────────────
  configNotes: string;
  onChangeConfigNotes: (v: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Configuration tab as a controlled component. The
 * parent form owns every value and supplies setters; this component
 * is purely presentation + interaction.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Configuration tab)
 */
export function ConfigurationTab(props: ConfigurationTabProps) {
  const {
    isCreate,
    productType,
    onChangeProductType,
    dim1Label,
    onChangeDim1Label,
    dim2Label,
    onChangeDim2Label,
    dimMin,
    onChangeDimMin,
    dimMax,
    onChangeDimMax,
    dimStep,
    onChangeDimStep,
    dimDefault1,
    onChangeDimDefault1,
    dimDefault2,
    onChangeDimDefault2,
    pricingMethod,
    onChangePricingMethod,
    ratePerSqmDollars,
    onChangeRatePerSqmDollars,
    minArea,
    onChangeMinArea,
    minPrice,
    onChangeMinPrice,
    basePrice,
    onChangeBasePrice,
    overheadRateDollars,
    onChangeOverheadRateDollars,
    pricingTiers,
    onAddTier,
    onChangeTier,
    onRemoveTier,
    pricingPreview,
    variants,
    onAddVariant,
    onChangeVariant,
    onRemoveVariant,
    addonGroups,
    onAddAddonGroup,
    onChangeAddonGroup,
    onRemoveAddonGroup,
    onAddAddonOption,
    onChangeAddonOption,
    onRemoveAddonOption,
    configNotes,
    onChangeConfigNotes,
  } = props;

  return (
    <div className="space-y-4">
      {/* ── Top info banner ──────────────────────────────────────────── */}
      <InfoBanner text="Set up how this product is configured when added to a quote. Dimensions drive the base price. Add-on groups let customers (or sales) select optional extras. Everything here is reflected in the quote builder configurator modal." />

      {/* ── Product type card ────────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Product type</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {PRODUCT_TYPE_OPTIONS.map((option) => (
            <ProductTypeOption
              key={option.id}
              option={option}
              selected={option.id === productType}
              onSelect={() => onChangeProductType(option.id)}
            />
          ))}
        </div>
      </Card>

      {/* ── Dimension inputs card (DIMENSION_BASED only) ─────────────── */}
      {productType === "DIMENSION_BASED" && (
        <Card padding="md">
          <p className="text-sm font-semibold text-slate-900">Dimension inputs</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Input
                label="Dimension 1 label"
                value={dim1Label}
                onChange={(e) => onChangeDim1Label(e.target.value)}
                placeholder="Width (m)"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Shown to sales team in the configurator
              </p>
            </div>
            <Input
              label="Dimension 2 label"
              value={dim2Label}
              onChange={(e) => onChangeDim2Label(e.target.value)}
              placeholder="Length (m)"
            />
            <Input
              label="Min value"
              value={dimMin}
              onChange={(e) =>
                onChangeDimMin(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0"
              inputMode="decimal"
            />
            <Input
              label="Max value"
              value={dimMax}
              onChange={(e) =>
                onChangeDimMax(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0"
              inputMode="decimal"
            />
            <div>
              <Input
                label="Step size (m)"
                value={dimStep}
                onChange={(e) =>
                  onChangeDimStep(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="1"
                inputMode="decimal"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                How much each + / – press changes the value
              </p>
            </div>
            <Input
              label="Default value 1"
              value={dimDefault1}
              onChange={(e) =>
                onChangeDimDefault1(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="3"
              inputMode="decimal"
            />
            <Input
              label="Default value 2"
              value={dimDefault2}
              onChange={(e) =>
                onChangeDimDefault2(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="3"
              inputMode="decimal"
            />
          </div>
        </Card>
      )}

      {/* ── Base pricing formula card (DIMENSION_BASED only) ─────────── */}
      {productType === "DIMENSION_BASED" && (
        <Card padding="md">
          <p className="text-sm font-semibold text-slate-900">
            Base pricing formula
          </p>

          {/* Author: Puran */}
          {/* Impact: Pricing method dropdown + three conditional input */}
          {/*         clusters keyed off `pricingMethod`. */}
          {/* Reason: spec §4 — three methods, three field sets. */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Pricing method
              </label>
              <StyledSelect
                value={pricingMethod}
                onChange={(e) =>
                  onChangePricingMethod(e.target.value as PricingMethod)
                }
              >
                <option value="per_sqm">Per sqm (width × length × rate)</option>
                <option value="flat_tier">Flat tier (lookup table)</option>
                <option value="base_plus_sqm">
                  Base price + per sqm above minimum
                </option>
              </StyledSelect>
            </div>
          </div>

          {/* ── Per-sqm cluster ─────────────────────────────────────── */}
          {pricingMethod === "per_sqm" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Input
                label="Rate per sqm ($)"
                value={ratePerSqmDollars}
                onChange={(e) =>
                  onChangeRatePerSqmDollars(
                    e.target.value.replace(/[^0-9.]/g, "")
                  )
                }
                placeholder="$ 0.00"
              />
              <div>
                <Input
                  label="Minimum area (sqm)"
                  value={minArea}
                  onChange={(e) =>
                    onChangeMinArea(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="0"
                  inputMode="decimal"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Minimum charge area regardless of dimensions selected
                </p>
              </div>
              <div>
                <Input
                  label="Minimum price ($)"
                  value={minPrice}
                  onChange={(e) =>
                    onChangeMinPrice(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="$ 0"
                  inputMode="numeric"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Floor price — quote never goes below this
                </p>
              </div>
            </div>
          )}

          {/* ── Base + per sqm cluster ──────────────────────────────── */}
          {pricingMethod === "base_plus_sqm" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <Input
                  label="Base price ($)"
                  value={basePrice}
                  onChange={(e) =>
                    onChangeBasePrice(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="$ 0"
                  inputMode="numeric"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Covers everything up to the minimum area below
                </p>
              </div>
              <div>
                <Input
                  label="Minimum area (sqm)"
                  value={minArea}
                  onChange={(e) =>
                    onChangeMinArea(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="0"
                  inputMode="decimal"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Threshold — area above this is charged at the overhead rate
                </p>
              </div>
              <div>
                <Input
                  label="Overhead rate per extra sqm ($)"
                  value={overheadRateDollars}
                  onChange={(e) =>
                    onChangeOverheadRateDollars(
                      e.target.value.replace(/[^0-9.]/g, "")
                    )
                  }
                  placeholder="$ 0.00"
                  inputMode="decimal"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Charged on every sqm above the minimum
                </p>
              </div>
            </div>
          )}

          {/* ── Flat tier cluster ───────────────────────────────────── */}
          {pricingMethod === "flat_tier" && (
            <div className="mt-4">
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <span>Area from (m²)</span>
                  <span>Area to (m²)</span>
                  <span>Price ($)</span>
                  <span className="sr-only">Remove</span>
                </div>
                {pricingTiers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    No tiers yet — add at least one row.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pricingTiers.map((tier) => (
                      <PricingTierRow
                        key={tier.key}
                        tier={tier}
                        onChange={(patch) => onChangeTier(tier.key, patch)}
                        onRemove={() => onRemoveTier(tier.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={onAddTier}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer self-start"
                >
                  <PlusIcon />
                  Add tier
                </button>
                <div className="sm:max-w-xs sm:w-1/2">
                  <Input
                    label="Fallback floor price ($)"
                    value={minPrice}
                    onChange={(e) =>
                      onChangeMinPrice(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="$ 0"
                    inputMode="numeric"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Used when the selected area doesn&rsquo;t match any tier
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live pricing preview computed in the parent via the
              shared `computeDimensionPreview` helper. */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-blue">Pricing preview</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {pricingPreview.map((cell) => (
                <PricingPreviewCellView
                  key={cell.key}
                  label={cell.label}
                  price={cell.price}
                  area={cell.area}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Size options card (SIZE_VARIANT only) ───────────────────────── */}
      {productType === "SIZE_VARIANT" && (
        <Card padding="md">
          <p className="text-sm font-semibold text-slate-900">Size options</p>
          <div className="mt-3">
            <InfoBanner text="Each size is a selectable option in the quote builder. The sales team picks one size — it sets the base price for that booking." />
          </div>

          {isCreate ? (
            // Author: Puran
            // Impact: create-mode guard — variants need a parent
            //         product id, so the user has to save the product
            //         first before they can add variants
            // Reason: Phase 2 sign-off — variants UI is disabled in
            //         create mode. Replacing the empty list with a
            //         friendly explanation prevents the user from
            //         filling in variant rows that would never be
            //         saved (since handleSave's create branch
            //         deliberately skips the variant sync).
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Save the product first
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Variants need a parent product id. Click
                &ldquo;Create Product&rdquo; up top to save the basics,
                then come back here to add Small / Medium / Large.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3">
                {variants.map((variant) => (
                  <VariantRow
                    key={variant.key}
                    variant={variant}
                    onChange={(patch) => onChangeVariant(variant.key, patch)}
                    onRemove={() => onRemoveVariant(variant.key)}
                  />
                ))}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onAddVariant}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer"
                >
                  <PlusIcon />
                  Add size
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Add-on groups card ───────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Add-on groups</p>

        <div className="mt-3">
          <InfoBanner text="Groups appear as sections in the quote builder configurator. Each group can have multiple options — the sales team selects any combination. Groups and options can be reordered by dragging." />
        </div>

        <div className="mt-4 flex flex-col gap-5 divide-y divide-slate-100">
          {addonGroups.map((group, index) => (
            <div key={group.id} className={index === 0 ? "" : "pt-5"}>
              <AddOnGroupBlock
                group={group}
                onChange={(patch) => onChangeAddonGroup(group.id, patch)}
                onRemove={() => onRemoveAddonGroup(group.id)}
                onOptionChange={(optionId, patch) =>
                  onChangeAddonOption(group.id, optionId, patch)
                }
                onRemoveOption={(optionId) =>
                  onRemoveAddonOption(group.id, optionId)
                }
                onAddOption={() => onAddAddonOption(group.id)}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddAddonGroup}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-[#1a2f6e] bg-white px-4 h-12 text-sm font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer"
        >
          <PlusIcon />
          Add add-on group
        </button>
      </Card>

      {/* ── Configuration notes card ────────────────────────────────── */}
      {/* Author: Puran */}
      {/* Impact: free-text notes the admin writes for the sales team, */}
      {/*         shown inside the quote builder configurator modal */}
      {/* Reason: spec §8 step 2 — the modal is built from */}
      {/*         pricingConfig + addonGroups + these notes */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Configuration notes
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Notes shown to sales team inside the configurator
        </p>
        <textarea
          value={configNotes}
          onChange={(e) => onChangeConfigNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. Bays are 3m wide — multiply selected width by number of bays for sidewall quantities."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-y min-h-32 leading-relaxed mt-3"
        />
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface InfoBannerProps {
  text: string;
}

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
        <p className="text-xs sm:text-sm text-blue leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

interface ProductTypeOptionProps {
  option: ProductTypeConfig;
  selected: boolean;
  onSelect: () => void;
}

function ProductTypeOption({
  option,
  selected,
  onSelect,
}: ProductTypeOptionProps) {
  const { Icon, label, description } = option;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={[
        "rounded-2xl border-2 px-5 py-5 text-center transition-colors cursor-pointer",
        selected
          ? "border-blue bg-blue-50"
          : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <Icon
        className={
          selected
            ? "mx-auto h-7 w-7 text-blue"
            : "mx-auto h-7 w-7 text-slate-500"
        }
      />
      <p
        className={[
          "mt-3 text-sm font-semibold",
          selected ? "text-blue" : "text-slate-900",
        ].join(" ")}
      >
        {label}
      </p>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        {description}
      </p>
    </button>
  );
}

interface PricingPreviewCellViewProps {
  label: string;
  price: string;
  area: string;
}

function PricingPreviewCellView({
  label,
  price,
  area,
}: PricingPreviewCellViewProps) {
  // Author: Puran
  // Impact: cell shell uses slate (bg-slate-100 / border-slate-200)
  //         instead of the brand-blue family — only the price stays
  //         on the brand `blue` token
  // Reason: Figma calls for `#F1F5F9` bg + `#E2E8F0` border (slate
  //         100/200). The cells are "computed output" inside an
  //         already-blue section header, so a second blue layer was
  //         too heavy. Slate de-emphasises the shell and lets the
  //         brand-blue price text do the visual work.
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-blue">{price}</p>
      <p className="mt-0.5 text-xs text-slate-500">{area}</p>
    </div>
  );
}

interface PricingTierRowProps {
  tier: TierDraft;
  onChange: (patch: Partial<TierDraft>) => void;
  onRemove: () => void;
}

/**
 * One row in the flat-tier pricing table — area-from / area-to /
 * price + delete. Mobile wraps in a slate-50 card with per-field
 * labels, same pattern as VariantRow.
 *
 * @author Puran
 * @created 2026-04-10
 * @module Module A - Products (Configuration tab)
 */
function PricingTierRow({ tier, onChange, onRemove }: PricingTierRowProps) {
  const rangeLabel =
    tier.areaFrom && tier.areaTo
      ? `${tier.areaFrom}–${tier.areaTo} m²`
      : "untitled tier";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-3 sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 sm:block">
          <label className="sm:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
            Area from (m²)
          </label>
          <div className="sm:hidden">
            <RemoveButton
              onClick={onRemove}
              label={`Remove tier ${rangeLabel}`}
            />
          </div>
        </div>
        <Input
          value={tier.areaFrom}
          onChange={(e) =>
            onChange({ areaFrom: e.target.value.replace(/[^0-9.]/g, "") })
          }
          placeholder="0"
          inputMode="decimal"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="sm:hidden text-xs font-medium text-slate-500">
          Area to (m²)
        </label>
        <Input
          value={tier.areaTo}
          onChange={(e) =>
            onChange({ areaTo: e.target.value.replace(/[^0-9.]/g, "") })
          }
          placeholder="9"
          inputMode="decimal"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="sm:hidden text-xs font-medium text-slate-500">
          Price ($)
        </label>
        <Input
          value={tier.price ? `$${tier.price}` : ""}
          onChange={(e) =>
            onChange({ price: e.target.value.replace(/[^0-9]/g, "") })
          }
          placeholder="$0"
          inputMode="numeric"
        />
      </div>
      <div className="hidden sm:flex sm:justify-center sm:items-center">
        <RemoveButton onClick={onRemove} label={`Remove tier ${rangeLabel}`} />
      </div>
    </div>
  );
}

interface VariantRowProps {
  variant: VariantDraft;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
}

/**
 * One row in the Size options list — label + day rate + qty +
 * delete. Mobile wraps each row in a slate-50 card with the ×
 * pinned to the top-right next to the SIZE NAME label, same
 * pattern as AddOnOptionRow so the form family stays uniform.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Configuration tab)
 */
function VariantRow({ variant, onChange, onRemove }: VariantRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid lg:grid-cols-[1fr_minmax(140px,180px)_minmax(100px,120px)_auto] lg:gap-3 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 lg:block">
          <label className="lg:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
            Size name
          </label>
          <div className="lg:hidden">
            <RemoveButton
              onClick={onRemove}
              label={`Remove size ${variant.label || "untitled"}`}
            />
          </div>
        </div>
        <Input
          value={variant.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Small (3×3m)"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Day rate
        </label>
        <Input
          value={variant.priceDay ? `$${variant.priceDay}` : ""}
          onChange={(e) =>
            onChange({ priceDay: e.target.value.replace(/[^0-9]/g, "") })
          }
          placeholder="$0"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Qty
        </label>
        <Input
          value={variant.quantity}
          onChange={(e) =>
            onChange({ quantity: e.target.value.replace(/[^0-9]/g, "") })
          }
          placeholder="1"
          inputMode="numeric"
        />
      </div>
      <div className="hidden lg:flex lg:justify-center lg:items-center">
        <RemoveButton
          onClick={onRemove}
          label={`Remove size ${variant.label || "untitled"}`}
        />
      </div>
    </div>
  );
}

interface AddOnGroupBlockProps {
  group: AddonGroup;
  onChange: (patch: Partial<AddonGroup>) => void;
  onRemove: () => void;
  onOptionChange: (optionId: string, patch: Partial<AddonOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onAddOption: () => void;
}

function AddOnGroupBlock({
  group,
  onChange,
  onRemove,
  onOptionChange,
  onRemoveOption,
  onAddOption,
}: AddOnGroupBlockProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Group header row — stacks on small screens */}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[20px_1fr_minmax(140px,180px)_auto_auto] lg:gap-3 lg:items-center">
        <div className="hidden lg:flex lg:items-center lg:justify-center text-slate-400">
          <DragHandleIcon />
        </div>
        <Input
          value={group.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Group name"
          className="font-semibold"
        />
        <StyledSelect
          value={group.selectionType}
          onChange={(e) =>
            onChange({ selectionType: e.target.value as AddonSelectionType })
          }
          aria-label="Selection mode"
        >
          {Object.entries(SELECTION_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StyledSelect>
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <Switch
            checked={group.customerVisible}
            onChange={() =>
              onChange({ customerVisible: !group.customerVisible })
            }
            ariaLabel={`Customer visible — ${group.label || "untitled group"}`}
          />
          <FilledRemoveButton
            onClick={onRemove}
            label={`Remove group ${group.label || "untitled"}`}
          />
        </div>
      </div>

      {/* Option rows */}
      <div className="flex flex-col gap-2">
        {group.options.map((option) => (
          <AddOnOptionRow
            key={option.id}
            option={option}
            onChange={(patch) => onOptionChange(option.id, patch)}
            onRemove={() => onRemoveOption(option.id)}
          />
        ))}
      </div>

      {/* Add option button */}
      <div>
        <button
          type="button"
          onClick={onAddOption}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer"
        >
          <PlusIcon />
          Add option
        </button>
      </div>
    </div>
  );
}

interface AddOnOptionRowProps {
  option: AddonOption;
  onChange: (patch: Partial<AddonOption>) => void;
  onRemove: () => void;
}

function AddOnOptionRow({ option, onChange, onRemove }: AddOnOptionRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid lg:grid-cols-[20px_1.2fr_1.4fr_minmax(100px,120px)_minmax(120px,140px)_auto] lg:gap-3 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <div className="hidden lg:flex lg:items-center lg:justify-center text-slate-400">
        <DragHandleIcon />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 lg:block">
          <label className="lg:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
            Option name
          </label>
          <div className="lg:hidden">
            <RemoveButton
              onClick={onRemove}
              label={`Remove option ${option.label || "untitled"}`}
            />
          </div>
        </div>
        <Input
          value={option.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Option name"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Description
        </label>
        <Input
          value={option.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Price
        </label>
        <Input
          value={option.price ? `+$ ${option.price}` : ""}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9]/g, "");
            onChange({ price: cleaned === "" ? 0 : parseInt(cleaned, 10) });
          }}
          placeholder="+$ 0"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Unit
        </label>
        <StyledSelect
          value={option.pricingUnit}
          onChange={(e) =>
            onChange({ pricingUnit: e.target.value as AddonPricingUnit })
          }
          aria-label={`Unit for ${option.label || "option"}`}
        >
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StyledSelect>
      </div>
      <div className="hidden lg:flex lg:justify-center lg:items-center">
        <RemoveButton
          onClick={onRemove}
          label={`Remove option ${option.label || "untitled"}`}
        />
      </div>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}

function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/50",
        checked ? "bg-[#1a2f6e]" : "bg-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

interface RemoveButtonProps {
  onClick: () => void;
  label: string;
}

function RemoveButton({ onClick, label }: RemoveButtonProps) {
  return (
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

function FilledRemoveButton({ onClick, label }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1a2f6e] text-white transition-colors hover:bg-[#15255a] cursor-pointer"
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

// ─── Product type icons ────────────────────────────────────────────────

function DimensionIcon({ className }: { className?: string }) {
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
        d="M6 3h12l3 6-9 13-9-13 3-6z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3l3 6" />
    </svg>
  );
}

function SizeVariantsIcon({ className }: { className?: string }) {
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
        d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h2" />
    </svg>
  );
}

function QuantityAddOnsIcon({ className }: { className?: string }) {
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
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
      />
    </svg>
  );
}

const PRODUCT_TYPE_OPTIONS: ProductTypeConfig[] = [
  {
    id: "DIMENSION_BASED",
    label: "Dimension-based",
    description: "Priced by width × length (e.g. marquees, flooring)",
    Icon: DimensionIcon,
  },
  {
    id: "SIZE_VARIANT",
    label: "Size variants",
    description: "Pick from a list of fixed sizes (e.g. small / medium / large)",
    Icon: SizeVariantsIcon,
  },
  {
    id: "QUANTITY_ADDONS",
    label: "Quantity + add-ons",
    description: "Fixed price, customer picks qty and optional extras",
    Icon: QuantityAddOnsIcon,
  },
];
