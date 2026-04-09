"use client";

/**
 * ConfigurationTab — optional 7th tab on the Product Details / Edit
 * screen, only present when the Basic Info "Configurable product"
 * toggle is on.
 *
 * Layout (top → bottom):
 *   1. Top info banner explaining the configurator concept.
 *   2. Product type card — 3 large selectable cards (Dimension-based,
 *      Size variants, Quantity + add-ons). Only one is active at a
 *      time. The Figma seeds Dimension-based as default.
 *   3. Dimension inputs card — labels for the two dimension axes
 *      (e.g. Width / Length), plus shared min/max value range.
 *   4. Base pricing formula card — pricing method, rate, min area,
 *      min price, AND a live "Pricing preview" sub-section that
 *      computes prices for 8 representative dimension pairs from
 *      `max(d1 × d2 × rate, minPrice)`.
 *   5. Add-on groups card — N groups, each with a header row (drag,
 *      name, selection mode, customer visible toggle, delete) and a
 *      nested list of option rows (drag, name, description, price,
 *      unit, delete) plus an "+ Add option" button per group, and a
 *      full-width "+ Add add-on group" button at the bottom of the
 *      card.
 *   6. Configuration notes card — single textarea for sales-team-
 *      visible notes inside the configurator.
 *
 * Backend status: same as the other product tabs — entirely client
 * state for V1. Drag-to-reorder is visual only; the dot-grip handles
 * are placeholders until the sortable wiring lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */

// Author: Puran
// Impact: new dedicated component for the Configuration tab — fills
//         in the last placeholder slot on the product editor
// Reason: matches the Figma's "configurable product" workflow end to
//         end. Every section seeds with the values shown in the Figma
//         so the screen looks right on first load.

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";

// ─── Types ─────────────────────────────────────────────────────────────

type ProductType = "dimension" | "size" | "qty";
type SelectionMode = "select_any" | "select_one" | "required";
type AddOnUnit = "flat" | "per_unit" | "per_bay" | "per_hour" | "per_day";

interface AddOnOption {
  id: string;
  name: string;
  description: string;
  /** Whole-dollar string so the input can hold partial values */
  price: string;
  unit: AddOnUnit;
}

/**
 * One row in the Size options list shown when productType === "size".
 * The Figma uses these for fixed-size variants like "Small (3×3m)" with
 * a base price and stock qty per variant.
 */
interface SizeOption {
  id: string;
  name: string;
  /** Whole-dollar price string */
  price: string;
  /** Available stock units for this size */
  qty: string;
}

interface AddOnGroup {
  id: string;
  name: string;
  selectionMode: SelectionMode;
  customerVisible: boolean;
  options: AddOnOption[];
}

interface ProductTypeConfig {
  id: ProductType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ─── Constants ─────────────────────────────────────────────────────────

const UNIT_LABELS: Record<AddOnUnit, string> = {
  flat: "Flat",
  per_unit: "Per Unit",
  per_bay: "Per Bay",
  per_hour: "Per Hour",
  per_day: "Per Day",
};

const SELECTION_MODE_LABELS: Record<SelectionMode, string> = {
  select_any: "Select Any",
  select_one: "Select One",
  required: "Required",
};

/**
 * Representative dimension pairs used by the live pricing preview.
 * Hardcoded for V1 so the preview always shows 8 cells regardless of
 * the user's min/max range. When V2 lands these will be generated
 * from the configured min/max + a smart spread algorithm.
 */
const PREVIEW_PAIRS: Array<readonly [number, number]> = [
  [3, 3],
  [3, 6],
  [6, 6],
  [6, 9],
  [6, 12],
  [9, 9],
  [9, 12],
  [12, 12],
];

// ─── Mock seeds ────────────────────────────────────────────────────────

const INITIAL_SIZES: SizeOption[] = [
  { id: "sz-small", name: "Small (3×3m)", price: "200", qty: "1" },
  { id: "sz-medium", name: "Medium (6×3m)", price: "320", qty: "2" },
  { id: "sz-large", name: "Large (6×6m)", price: "520", qty: "1" },
];

const INITIAL_GROUPS: AddOnGroup[] = [
  {
    id: "g-sidewalls",
    name: "Sidewalls",
    selectionMode: "select_any",
    customerVisible: true,
    options: [
      {
        id: "o-solid",
        name: "Solid sidewall",
        description: "Opaque white panel per bay",
        price: "45",
        unit: "per_bay",
      },
      {
        id: "o-clear",
        name: "Clear PVC sidewall",
        description: "Transparent panel per bay",
        price: "60",
        unit: "per_bay",
      },
    ],
  },
  {
    id: "g-flooring",
    name: "Flooring",
    selectionMode: "select_any",
    customerVisible: true,
    options: [
      {
        id: "o-carpet",
        name: "Carpet flooring",
        description: "Grey event carpet, cut to size",
        price: "80",
        unit: "flat",
      },
      {
        id: "o-timber",
        name: "Timber dance floor",
        description: "Interlocking timber panels",
        price: "180",
        unit: "flat",
      },
      {
        id: "o-rubber",
        name: "Rubber matting",
        description: "Suitable for uneven ground",
        price: "60",
        unit: "flat",
      },
    ],
  },
  {
    id: "g-lighting",
    name: "Lighting",
    selectionMode: "select_any",
    customerVisible: true,
    options: [
      {
        id: "o-fairy",
        name: "Fairy lights",
        description: "Warm white string lights",
        price: "65",
        unit: "flat",
      },
      {
        id: "o-chandelier",
        name: "Crystal chandelier",
        description: "Single centrepiece chandelier",
        price: "120",
        unit: "per_unit",
      },
      {
        id: "o-led",
        name: "LED strip lighting",
        description: "Colour-changeable perimeter LEDs",
        price: "90",
        unit: "flat",
      },
    ],
  },
  {
    id: "g-chairs",
    name: "Chairs & Tables",
    selectionMode: "select_any",
    customerVisible: true,
    options: [
      {
        id: "o-tiffany",
        name: "Tiffany chairs",
        description: "White or gold, per chair",
        price: "5",
        unit: "per_unit",
      },
      {
        id: "o-trestle",
        name: "Trestle table",
        description: "1.8m folding table, per table",
        price: "25",
        unit: "per_unit",
      },
    ],
  },
];

const INITIAL_NOTES = `Bays are 3m wide — multiply selected width by number of bays for sidewall quantities.
Timber dance floor requires 48 hours notice — flag in booking notes.
Lighting options are additive — customer can select more than one.`;

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Configuration tab. State is owned locally for V1;
 * lift to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */
export function ConfigurationTab() {
  // ── Product type ────────────────────────────────────────────────────
  const [productType, setProductType] = useState<ProductType>("dimension");

  // ── Dimension inputs ────────────────────────────────────────────────
  const [dim1Label, setDim1Label] = useState("Width (m)");
  const [dim2Label, setDim2Label] = useState("Length (m)");
  const [minValue, setMinValue] = useState("3");
  const [maxValue, setMaxValue] = useState("12");
  // Author: Puran
  // Impact: added Step size + Default dimensions to match the Figma
  // Reason: client flagged the Dimension inputs card was missing the
  //         last two fields. Step size drives the +/- increment in
  //         the configurator, default dimensions seeds the picker.
  const [stepSize, setStepSize] = useState("1");
  const [defaultDimensions, setDefaultDimensions] = useState("3 × 3");

  // ── Base pricing formula ────────────────────────────────────────────
  const [pricingMethod, setPricingMethod] = useState("per_sqm");
  const [ratePerSqm, setRatePerSqm] = useState("8");
  const [minArea, setMinArea] = useState("9");
  const [minPrice, setMinPrice] = useState("200");

  // ── Size options (used when productType === "size") ─────────────────
  // Author: Puran
  // Impact: separate state slice for the Size variants flow so the
  //         user's edits are preserved when they toggle product type
  //         back and forth between Dimension-based and Size variants
  // Reason: matches the Figma where Size variants replaces the
  //         Dimension inputs + Base pricing formula cards entirely
  //         with a list of named sizes (Small / Medium / Large) each
  //         with its own price and stock qty
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>(INITIAL_SIZES);

  // Note: Quantity + add-ons (productType === "qty") deliberately has
  // NO state on this tab. The Figma shows nothing between Product type
  // and Add-on groups for that mode — base price for qty products is
  // set in the Pricing tab (the AI-driven natural-language pricing),
  // and the Configuration tab is purely about how the product is
  // presented in the configurator. Add-on groups + Configuration notes
  // still render for qty products.

  // ── Add-on groups ───────────────────────────────────────────────────
  const [groups, setGroups] = useState<AddOnGroup[]>(INITIAL_GROUPS);

  // ── Configuration notes ─────────────────────────────────────────────
  const [configNotes, setConfigNotes] = useState(INITIAL_NOTES);

  // ── Pricing preview computation ─────────────────────────────────────
  // Author: Puran
  // Impact: live-computed pricing preview that updates as the user
  //         edits Rate per sqm and Minimum price
  // Reason: matches the Figma's expectation that the sales-team-facing
  //         price table is always in sync with the formula above. Uses
  //         max(area × rate, minPrice) to model the floor-price rule
  //         (small dimensions hit the minimum, large dimensions get
  //         the full per-sqm calculation).
  const pricingPreview = useMemo(() => {
    const rate = Number(ratePerSqm) || 0;
    const floor = Number(minPrice) || 0;
    return PREVIEW_PAIRS.map(([d1, d2]) => {
      const area = d1 * d2;
      const computed = area * rate;
      const finalPrice = Math.max(computed, floor);
      return {
        key: `${d1}x${d2}`,
        label: `${d1}×${d2}m`,
        price: `$${finalPrice}`,
        area: `${area}m²`,
      };
    });
  }, [ratePerSqm, minPrice]);

  // ── Size option CRUD ────────────────────────────────────────────────

  const handleSizeChange = <K extends keyof SizeOption>(
    sizeId: string,
    field: K,
    value: SizeOption[K],
  ) => {
    setSizeOptions((prev) =>
      prev.map((s) => (s.id === sizeId ? { ...s, [field]: value } : s)),
    );
  };

  const handleRemoveSize = (sizeId: string) => {
    setSizeOptions((prev) => prev.filter((s) => s.id !== sizeId));
  };

  const handleAddSize = () => {
    setSizeOptions((prev) => [
      ...prev,
      {
        id: `sz-${Date.now().toString(36)}`,
        name: "",
        price: "0",
        qty: "1",
      },
    ]);
  };

  // ── Group / option CRUD ─────────────────────────────────────────────

  const handleGroupChange = <K extends keyof AddOnGroup>(
    groupId: string,
    field: K,
    value: AddOnGroup[K],
  ) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g)),
    );
  };

  const handleRemoveGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleAddGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: `g-${Date.now().toString(36)}`,
        name: "",
        selectionMode: "select_any",
        customerVisible: true,
        options: [],
      },
    ]);
  };

  const handleOptionChange = <K extends keyof AddOnOption>(
    groupId: string,
    optionId: string,
    field: K,
    value: AddOnOption[K],
  ) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: g.options.map((o) =>
                o.id === optionId ? { ...o, [field]: value } : o,
              ),
            },
      ),
    );
  };

  const handleRemoveOption = (groupId: string, optionId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, options: g.options.filter((o) => o.id !== optionId) },
      ),
    );
  };

  const handleAddOption = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: [
                ...g.options,
                {
                  id: `o-${Date.now().toString(36)}`,
                  name: "",
                  description: "",
                  price: "0",
                  unit: "flat",
                },
              ],
            },
      ),
    );
  };

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
              onSelect={() => setProductType(option.id)}
            />
          ))}
        </div>
      </Card>

      {/* Author: Puran */}
      {/* Impact: pricing section is now conditional on productType */}
      {/* Reason: matches the Figma — Dimension inputs + Base pricing */}
      {/*         formula only show for Dimension-based; Size variants */}
      {/*         replaces them with a Size options card; Quantity + */}
      {/*         add-ons replaces them with a single Base price card. */}
      {/*         Add-on groups + Configuration notes always show. */}
      {productType === "dimension" && (
      <>
      {/* ── Dimension inputs card ────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Dimension inputs</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <Input
              label="Dimension 1 label"
              value={dim1Label}
              onChange={(e) => setDim1Label(e.target.value)}
              placeholder="Width (m)"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Shown to sales team in the configurator
            </p>
          </div>
          <Input
            label="Dimension 2 label"
            value={dim2Label}
            onChange={(e) => setDim2Label(e.target.value)}
            placeholder="Length (m)"
          />
          <Input
            label="Min value"
            value={minValue}
            onChange={(e) =>
              setMinValue(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="0"
            inputMode="decimal"
          />
          <Input
            label="Max value"
            value={maxValue}
            onChange={(e) =>
              setMaxValue(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="0"
            inputMode="decimal"
          />
          <div>
            <Input
              label="Step size (m)"
              value={stepSize}
              onChange={(e) =>
                setStepSize(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="1"
              inputMode="decimal"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              How much each + / – press changes the value
            </p>
          </div>
          <Input
            label="Default dimensions"
            value={defaultDimensions}
            onChange={(e) => setDefaultDimensions(e.target.value)}
            placeholder="3 × 3"
          />
        </div>
      </Card>

      {/* ── Base pricing formula card (with live preview) ─────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Base pricing formula
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Pricing method
            </label>
            <StyledSelect
              value={pricingMethod}
              onChange={(e) => setPricingMethod(e.target.value)}
            >
              <option value="per_sqm">Per sqm (width × length × rate)</option>
              <option value="flat">Flat rate</option>
              <option value="per_unit">Per unit</option>
            </StyledSelect>
          </div>
          <Input
            label="Rate per sqm ($)"
            value={ratePerSqm ? `$ ${ratePerSqm}` : ""}
            onChange={(e) =>
              setRatePerSqm(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="$ 0"
          />
          <div>
            <Input
              label="Minimum area (sqm)"
              value={minArea}
              onChange={(e) =>
                setMinArea(e.target.value.replace(/[^0-9.]/g, ""))
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
              value={minPrice ? `$ ${minPrice}` : ""}
              onChange={(e) =>
                setMinPrice(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="$ 0"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Floor price — quote never goes below this
            </p>
          </div>
        </div>

        {/* Pricing preview — inside the same card with a thin border
            separator above. The cells light up the brand blue colour
            so they read as "computed output" rather than user input. */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-blue">Pricing preview</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pricingPreview.map((cell) => (
              <PricingPreviewCell
                key={cell.key}
                label={cell.label}
                price={cell.price}
                area={cell.area}
              />
            ))}
          </div>
        </div>
      </Card>
      </>
      )}

      {/* ── Size options card (productType === "size") ─────────────────── */}
      {productType === "size" && (
        <Card padding="md">
          <p className="text-sm font-semibold text-slate-900">Size options</p>
          <div className="mt-3">
            <InfoBanner text="Each size is a selectable option in the quote builder. The sales team picks one size — it sets the base price for that booking." />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {sizeOptions.map((size) => (
              <SizeOptionRow
                key={size.id}
                size={size}
                onChange={(field, value) =>
                  handleSizeChange(size.id, field, value)
                }
                onRemove={() => handleRemoveSize(size.id)}
              />
            ))}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleAddSize}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e]/40 bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
            >
              <PlusIcon />
              Add size
            </button>
          </div>
        </Card>
      )}

      {/* Author: Puran */}
      {/* Impact: removed the placeholder Base price card for qty mode */}
      {/* Reason: Figma confirmed Quantity + add-ons has nothing between */}
      {/*         Product type and Add-on groups — base price is set in */}
      {/*         the Pricing tab (AI-driven), Configuration is purely */}
      {/*         about presentation. So qty falls straight through to */}
      {/*         the always-rendered Add-on groups + Config notes. */}

      {/* ── Add-on groups card ───────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Add-on groups</p>

        <div className="mt-3">
          <InfoBanner text="Groups appear as sections in the quote builder configurator. Each group can have multiple options — the sales team selects any combination. Groups and options can be reordered by dragging." />
        </div>

        <div className="mt-4 flex flex-col gap-5 divide-y divide-slate-100">
          {groups.map((group, index) => (
            <div key={group.id} className={index === 0 ? "" : "pt-5"}>
              <AddOnGroupBlock
                group={group}
                onChange={(field, value) =>
                  handleGroupChange(group.id, field, value)
                }
                onRemove={() => handleRemoveGroup(group.id)}
                onOptionChange={(optionId, field, value) =>
                  handleOptionChange(group.id, optionId, field, value)
                }
                onRemoveOption={(optionId) =>
                  handleRemoveOption(group.id, optionId)
                }
                onAddOption={() => handleAddOption(group.id)}
              />
            </div>
          ))}
        </div>

        {/* Full-width "Add add-on group" button */}
        <button
          type="button"
          onClick={handleAddGroup}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-[#1a2f6e]/40 bg-white px-4 h-12 text-sm font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
        >
          <PlusIcon />
          Add add-on group
        </button>
      </Card>

      {/* ── Configuration notes card ─────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Configuration notes
        </p>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Notes shown to sales team inside the configurator
        </p>
        <textarea
          value={configNotes}
          onChange={(e) => setConfigNotes(e.target.value)}
          rows={5}
          aria-label="Configuration notes"
          className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-y min-h-25 leading-relaxed"
        />
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface InfoBannerProps {
  text: string;
}

/**
 * Brand-blue info banner — uses the `blue` token (#0062FF) for icon
 * + body text. Same shape as the Inventory / Warehouse / Notes &
 * Rules tab banners.
 */
function InfoBanner({ text }: InfoBannerProps) {
  return (
    <div className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3">
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

/**
 * Large selectable card representing one of the three product types.
 * Selected state uses the brand blue palette (border + bg + title)
 * matching the Figma. Click anywhere on the card toggles selection.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */
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
      // Author: Puran
      // Impact: selected border now uses the brand `blue` token (#0062FF)
      // Reason: client confirmed the selected state should be brand blue
      //         to match the title + icon, not the dark navy I was using.
      //         Single design-token source — same colour the InfoBanner
      //         icon, the SummaryChip primary, and the Pricing preview
      //         numbers all use.
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

interface PricingPreviewCellProps {
  label: string;
  price: string;
  area: string;
}

/**
 * Read-only pricing preview cell. Light slate bg with the price in
 * brand blue so it visually stands out as the "computed output".
 */
function PricingPreviewCell({ label, price, area }: PricingPreviewCellProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-blue">{price}</p>
      <p className="mt-0.5 text-xs text-slate-500">{area}</p>
    </div>
  );
}

interface SizeOptionRowProps {
  size: SizeOption;
  onChange: <K extends keyof SizeOption>(
    field: K,
    value: SizeOption[K],
  ) => void;
  onRemove: () => void;
}

/**
 * One row in the Size options list — name + price + qty + delete.
 *
 * Desktop (lg+): flat 4-column grid (name | price | qty | delete).
 * Mobile/tablet: each row wraps in a slate-50 card with the × delete
 * pinned to the top-right next to the SIZE NAME label, same pattern
 * as AddOnOptionRow so the form family stays uniform.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */
function SizeOptionRow({ size, onChange, onRemove }: SizeOptionRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid lg:grid-cols-[1fr_minmax(140px,180px)_minmax(100px,120px)_auto] lg:gap-3 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <div className="flex flex-col gap-1.5">
        {/* Mobile: label + delete share a row inside the size card so
            the × anchors to the card visually. Desktop: label hidden
            and delete lives in its own column at the end. */}
        <div className="flex items-center justify-between gap-2 lg:block">
          <label className="lg:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
            Size name
          </label>
          <div className="lg:hidden">
            <RemoveButton
              onClick={onRemove}
              label={`Remove size ${size.name || "untitled"}`}
            />
          </div>
        </div>
        <Input
          value={size.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g. Small (3×3m)"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Price
        </label>
        <Input
          value={size.price ? `$${size.price}` : ""}
          onChange={(e) =>
            onChange("price", e.target.value.replace(/[^0-9.]/g, ""))
          }
          placeholder="$0"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Qty
        </label>
        <Input
          value={size.qty}
          onChange={(e) => onChange("qty", e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="1"
          inputMode="numeric"
        />
      </div>
      {/* Desktop-only delete column — mobile delete lives next to the
          Size name label above. */}
      <div className="hidden lg:flex lg:justify-center lg:items-center">
        <RemoveButton
          onClick={onRemove}
          label={`Remove size ${size.name || "untitled"}`}
        />
      </div>
    </div>
  );
}

interface AddOnGroupBlockProps {
  group: AddOnGroup;
  onChange: <K extends keyof AddOnGroup>(field: K, value: AddOnGroup[K]) => void;
  onRemove: () => void;
  onOptionChange: <K extends keyof AddOnOption>(
    optionId: string,
    field: K,
    value: AddOnOption[K],
  ) => void;
  onRemoveOption: (optionId: string) => void;
  onAddOption: () => void;
}

/**
 * One add-on group block — header row (drag, name, mode, customer
 * visible toggle, delete) followed by the nested option rows and an
 * "+ Add option" button.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */
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
          value={group.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Group name"
          className="font-semibold"
        />
        <StyledSelect
          value={group.selectionMode}
          onChange={(e) =>
            onChange("selectionMode", e.target.value as SelectionMode)
          }
          aria-label="Selection mode"
        >
          {Object.entries(SELECTION_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StyledSelect>
        {/* Author: Puran */}
        {/* Impact: removed the "Customer visible" text label next to the */}
        {/*         switch — toggle stands alone now */}
        {/* Reason: client requested the label text be removed; the */}
        {/*         switch state itself communicates the on/off, and */}
        {/*         the aria-label keeps screen readers informed. */}
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <Switch
            checked={group.customerVisible}
            onChange={() => onChange("customerVisible", !group.customerVisible)}
            ariaLabel={`Customer visible — ${group.name || "untitled group"}`}
          />
          <FilledRemoveButton
            onClick={onRemove}
            label={`Remove group ${group.name || "untitled"}`}
          />
        </div>
      </div>

      {/* Option rows */}
      <div className="flex flex-col gap-2">
        {group.options.map((option) => (
          <AddOnOptionRow
            key={option.id}
            option={option}
            onChange={(field, value) => onOptionChange(option.id, field, value)}
            onRemove={() => onRemoveOption(option.id)}
          />
        ))}
      </div>

      {/* Add option button */}
      <div>
        <button
          type="button"
          onClick={onAddOption}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e]/40 bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
        >
          <PlusIcon />
          Add option
        </button>
      </div>
    </div>
  );
}

interface AddOnOptionRowProps {
  option: AddOnOption;
  onChange: <K extends keyof AddOnOption>(
    field: K,
    value: AddOnOption[K],
  ) => void;
  onRemove: () => void;
}

/**
 * One add-on option row — drag handle + name + description + price
 * + unit select + delete. Stacks vertically below lg.
 *
 * Old Author: Puran
 * New Author: Puran
 * Impact: × delete button now sits inline with the "Option name"
 *         label on mobile (top-right of the stacked block) instead
 *         of floating alone at the bottom
 * Reason: at iPad Mini / iPhone widths the original layout dropped
 *         the × button onto its own row at the very bottom of the
 *         option block, where it looked disconnected from the option
 *         it actually deletes. Anchoring it to the Option name label
 *         on mobile makes the relationship obvious. Desktop layout
 *         (lg+) is unchanged — × stays at the end of the inline row.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Configuration tab)
 */
function AddOnOptionRow({ option, onChange, onRemove }: AddOnOptionRowProps) {
  return (
    // Old Author: Puran
    // New Author: Puran
    // Impact: mobile/tablet wraps the option in a subtle card so the
    //         row is visually contained and the × button has a clear
    //         boundary to anchor to. Desktop is unchanged — flat grid.
    // Reason: at iPhone widths the previous "× next to label" fix
    //         still looked floaty because there was no visual divider
    //         between options. Adding a slate-50 + border container
    //         per option gives each one its own card and makes the
    //         delete button's relationship obvious.
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid lg:grid-cols-[20px_1.2fr_1.4fr_minmax(100px,120px)_minmax(120px,140px)_auto] lg:gap-3 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <div className="hidden lg:flex lg:items-center lg:justify-center text-slate-400">
        <DragHandleIcon />
      </div>
      <div className="flex flex-col gap-1.5">
        {/* Mobile: label + delete share a row inside the option card
            so the × anchors to the card visually. Desktop: label is
            hidden and delete lives in its own column at the end of
            the row. */}
        <div className="flex items-center justify-between gap-2 lg:block">
          <label className="lg:hidden text-xs font-semibold uppercase tracking-wide text-slate-500">
            Option name
          </label>
          <div className="lg:hidden">
            <RemoveButton
              onClick={onRemove}
              label={`Remove option ${option.name || "untitled"}`}
            />
          </div>
        </div>
        <Input
          value={option.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Option name"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Description
        </label>
        <Input
          value={option.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Description"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Price
        </label>
        <Input
          value={option.price ? `+$ ${option.price}` : ""}
          onChange={(e) =>
            onChange("price", e.target.value.replace(/[^0-9.]/g, ""))
          }
          placeholder="+$ 0"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="lg:hidden text-xs font-medium text-slate-500">
          Unit
        </label>
        <StyledSelect
          value={option.unit}
          onChange={(e) => onChange("unit", e.target.value as AddOnUnit)}
          aria-label={`Unit for ${option.name || "option"}`}
        >
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StyledSelect>
      </div>
      {/* Desktop-only delete column — mobile delete lives next to the
          Option name label above. */}
      <div className="hidden lg:flex lg:justify-center lg:items-center">
        <RemoveButton
          onClick={onRemove}
          label={`Remove option ${option.name || "untitled"}`}
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

/**
 * Small inline switch used inside the add-on group header for the
 * Customer visible toggle. Same h-6 w-11 dimensions as the Pricing
 * tab discounting toggles.
 */
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

/**
 * Outlined-blue circular delete button used for option rows. Same
 * shape as the Inventory / Pricing tab delete buttons.
 */
function RemoveButton({ onClick, label }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a2f6e]/40 text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
      aria-label={label}
    >
      <svg
        className="h-4 w-4"
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
  );
}

/**
 * Filled solid-navy circular delete button — used for the group
 * header delete (so it visually outranks the option-row deletes,
 * matching the Figma where the group delete is a darker filled
 * circle and option deletes are outlined).
 */
function FilledRemoveButton({ onClick, label }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a2f6e] text-white transition-colors hover:bg-[#15255a]"
      aria-label={label}
    >
      <svg
        className="h-4 w-4"
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

// ─── Product type icons ────────────────────────────────────────────────
//
// Author: Puran
// Impact: rebuilt the three product-type icons to match the Figma 1:1
// Reason: previous DimensionIcon was a custom hybrid square+X path
//         (wrong shape) and SizeVariantsIcon only had 2 text lines
//         instead of the 3 (short + 2 long) shown in the Figma. New
//         paths are Heroicons / Lucide derivatives matching the
//         exact strokes shown.

/**
 * Gem / diamond outline — flat top with two angled corners cutting
 * down to a centre point at the bottom, plus a short interior stroke
 * on the upper-left edge that creates the "bracket" detail visible
 * in the Figma. Used for the Dimension-based product type card.
 */
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3l3 6"
      />
    </svg>
  );
}

/**
 * Document with text lines — folded corner + 3 horizontal text marks
 * (one short dash near the top, two longer lines below). Used for
 * the Size variants product type card. Derived from Lucide
 * `file-text`.
 */
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2v6h6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 13h8"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 17h8"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 9h2"
      />
    </svg>
  );
}

/**
 * 3D cube outline showing 3 visible faces (top, front-left,
 * front-right) with an internal vertical fold line on the top face.
 * Heroicons `CubeIcon`. Used for the Quantity + add-ons product
 * type card.
 */
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
    id: "dimension",
    label: "Dimension-based",
    description: "Priced by width × length (e.g. marquees, flooring)",
    Icon: DimensionIcon,
  },
  {
    id: "size",
    label: "Size variants",
    description: "Pick from a list of fixed sizes (e.g. small / medium / large)",
    Icon: SizeVariantsIcon,
  },
  {
    id: "qty",
    label: "Quantity + add-ons",
    description: "Fixed price, customer picks qty and optional extras",
    Icon: QuantityAddOnsIcon,
  },
];
