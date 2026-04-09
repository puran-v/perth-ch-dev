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
import { Combobox } from "@/components/ui/Combobox";
import { PricingTab } from "@/components/products/PricingTab";
import { InventoryTab } from "@/components/products/InventoryTab";
import { OperationalTab } from "@/components/products/OperationalTab";
import { WarehouseTab } from "@/components/products/WarehouseTab";
import { NotesRulesTab } from "@/components/products/NotesRulesTab";
import { ConfigurationTab } from "@/components/products/ConfigurationTab";
import { ProductImagesUploader } from "@/components/products/ProductImagesUploader";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/products/useProducts";
import {
  useCategories,
  useCreateCategory,
} from "@/hooks/products/useCategories";
// Author: Puran
// Impact: Phase 2 — variant CRUD hooks orchestrated in handleSave
//         after the parent product save commits
// Reason: bulk save uses the parent-first / children-second pattern
//         from the sign-off (no new bulk endpoint).
import { apiClient } from "@/lib/api-client";
import type {
  AddonGroup,
  AddonOption,
  CreateProductInput,
  CreateVariantInput,
  DimensionBasedConfig,
  PricingMethod,
  ProductCategory,
  ProductRow,
  ProductStatus,
  ProductType,
  UpdateProductInput,
  UpdateVariantInput,
} from "@/types/products";
import {
  computeDimensionPreview,
  dollarStringToCents,
} from "@/lib/products/pricing";

interface ProductEditorFormProps {
  /**
   * Existing product when in edit mode; null when in create mode.
   * The component derives `mode` internally from this so callers
   * never have to pass both.
   */
  initialProduct: ProductRow | null;
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
// Impact: Configuration tab is BACK to conditional — only present
//         when the `Configurable product` toggle on Basic Info is on
// Reason: client confirmed the toggle is the gate again (the earlier
//         "always visible" decision was reversed). The toggle and
//         the productType discriminator stay in lock-step via
//         `handleToggleConfigurable` so the user can't be in a state
//         where Configuration is hidden but productType !== STANDARD.
//         When the user toggles OFF while sitting on the Configuration
//         tab, the handler also bounces them back to Basic Info so
//         activeTab can never point at a tab that's been removed.
const ALL_TABS: TabConfig[] = [
  { id: "basic", label: "Basic Info" },
  { id: "pricing", label: "Pricing" },
  { id: "inventory", label: "Inventory" },
  { id: "operational", label: "Operational" },
  { id: "warehouse", label: "Warehouse" },
  { id: "configuration", label: "Configuration", icon: CogIcon },
  { id: "notes", label: "Notes & Rules" },
];

/**
 * Returns the visible tab list for the current configurable state.
 * Configuration is dropped when `configurable === false` so the user
 * can't navigate to it on a non-configurable product.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
function buildTabs(configurable: boolean): TabConfig[] {
  if (configurable) return ALL_TABS;
  return ALL_TABS.filter((t) => t.id !== "configuration");
}

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

  // Author: Puran
  // Impact: category is now a selected ProductCategory row (FK), not
  //         a free-text string. Hydrate from `initialProduct.categoryRef`
  //         on mount — the API ships the relation alongside the row
  //         so the combobox label shows the canonical name immediately.
  // Reason: dropping the free-text Input for the per-org master list
  //         + combobox pattern. categoryRef arrives in the same GET
  //         payload as the rest of the row so there's no flash of
  //         empty trigger while a separate categories query loads.
  const initialCategory: ProductCategory | null = initialProduct?.categoryRef
    ? {
        id: initialProduct.categoryRef.id,
        orgId: initialProduct.orgId,
        name: initialProduct.categoryRef.name,
        slug: initialProduct.categoryRef.slug,
        sortOrder: 0,
        active: true,
        createdAt: initialProduct.createdAt,
        updatedAt: initialProduct.updatedAt,
      }
    : null;
  // `userPickedCategory` holds whatever the user actively selected
  // (or `null` if they cleared the field). The displayed value is
  // `userPickedCategory ?? hydratedFromLegacy ?? initialCategory`,
  // computed via useMemo below. We split the user picks from the
  // hydration source so the late-binding match never overwrites a
  // deliberate clear.
  const [userPickedCategory, setUserPickedCategory] = useState<
    ProductCategory | "cleared" | null
  >(initialCategory);

  // Author: Puran
  // Impact: live categories list + create-on-the-fly mutation for the
  //         combobox. The list is cached aggressively (5 min staleTime)
  //         so opening the combobox is instant.
  // Reason: combobox needs both — `useCategories` populates the
  //         dropdown options, `useCreateCategory` powers the inline
  //         "+ Add" row when the user types a name that doesn't exist.
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const createCategory = useCreateCategory();

  // Author: Puran
  // Impact: late-binding hydration computed during render (no effect)
  // Reason: when categoryRef wasn't sent (older rows from before the
  //         dual-write rollout) but the legacy `category` string is
  //         set, match the string against the loaded categories list
  //         and pre-select the matching row. Computing this during
  //         render via useMemo avoids the `setState in effect` lint
  //         rule and keeps the form deterministic — no transient
  //         intermediate states. The user picking or clearing the
  //         field always wins because we check userPickedCategory
  //         first.
  const selectedCategory: ProductCategory | null = useMemo(() => {
    // User actively picked or cleared the field — that always wins.
    if (userPickedCategory === "cleared") return null;
    if (userPickedCategory) return userPickedCategory;
    // No active pick — try late-binding from the legacy category string.
    const legacyName = initialProduct?.category?.trim().toLowerCase();
    if (legacyName) {
      const match = categories.find((c) => c.slug === legacyName);
      if (match) return match;
    }
    return null;
  }, [userPickedCategory, initialProduct?.category, categories]);

  // Combobox onChange shim — translates the picker's `null` (cleared)
  // into our sentinel so the late-binding hydration doesn't undo it.
  const handleCategoryChange = (next: ProductCategory | null) => {
    setUserPickedCategory(next === null ? "cleared" : next);
  };

  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [configurable, setConfigurable] = useState(initialProduct?.configurable ?? false);
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status ?? "ACTIVE");
  const [tags, setTags] = useState<string[]>(initialProduct?.tags ?? []);

  // Author: Puran
  // Impact: real API mutations replace the toast stub
  // Reason: Save Changes / Create Product now persist through to the
  //         backend. `useUpdateProduct` is only meaningful in edit mode
  //         (it needs an id), so we hand it a safe placeholder for create
  //         mode and only invoke it inside the edit branch of handleSave.
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(initialProduct?.id ?? "");
  const isSaving = createProduct.isPending || updateProduct.isPending;
  const [tagDraft, setTagDraft] = useState("");
  // Author: Puran
  // Impact: images live in form state as base64 data URLs (V1 storage)
  // Reason: matches the OrgSetup.branding.logoDataUrl pattern — no
  //         object storage yet, so we send the data URL straight to
  //         the API and it lands in products.images (text[]) as-is.
  //         When real storage lands, this state still holds strings,
  //         just URLs instead of data URLs — no other changes needed.
  const [images, setImages] = useState<string[]>(initialProduct?.images ?? []);

  // Author: Puran
  // Impact: Operational tab state — every numeric field is held as a
  //         display string so the user can clear and re-type freely.
  //         Conversion to number | null happens in buildPayload().
  // Reason: holding numbers in state forces a 0 fallback when the
  //         input is empty, which made dimension fields show "0"
  //         instead of the placeholder. Strings keep the editor honest.
  const numToStr = (n: number | null | undefined) =>
    n === null || n === undefined ? "" : String(n);

  const [setupMinutes, setSetupMinutes] = useState(
    numToStr(initialProduct?.setupMinutes)
  );
  const [packdownMinutes, setPackdownMinutes] = useState(
    numToStr(initialProduct?.packdownMinutes)
  );
  const [staffSetup, setStaffSetup] = useState(
    numToStr(initialProduct?.staffSetup)
  );
  const [staffOperate, setStaffOperate] = useState(
    numToStr(initialProduct?.staffOperate)
  );
  const [lengthM, setLengthM] = useState(numToStr(initialProduct?.lengthM));
  const [widthM, setWidthM] = useState(numToStr(initialProduct?.widthM));
  const [heightM, setHeightM] = useState(numToStr(initialProduct?.heightM));
  const [weightKg, setWeightKg] = useState(numToStr(initialProduct?.weightKg));
  const [truckSpaceUnits, setTruckSpaceUnits] = useState(
    numToStr(initialProduct?.truckSpaceUnits)
  );
  const [handlingFlags, setHandlingFlags] = useState<string[]>(
    initialProduct?.handlingFlags ?? []
  );

  // Author: Puran
  // Impact: Warehouse tab state — strings collapse to "" when null so
  //         the inputs render the placeholder cleanly; booleans default
  //         to false; custom rules default to an empty array
  // Reason: matches the Operational tab pattern — parent owns every
  //         field so buildPayload() can roll them into the same
  //         create/update mutation as Basic Info + Operational
  const [warehouseZone, setWarehouseZone] = useState(
    initialProduct?.warehouseZone ?? ""
  );
  const [warehouseBayShelf, setWarehouseBayShelf] = useState(
    initialProduct?.warehouseBayShelf ?? ""
  );
  const [warehouseLocationNotes, setWarehouseLocationNotes] = useState(
    initialProduct?.warehouseLocationNotes ?? ""
  );
  const [requiresCleaning, setRequiresCleaning] = useState(
    initialProduct?.requiresCleaning ?? false
  );
  const [requiresCharging, setRequiresCharging] = useState(
    initialProduct?.requiresCharging ?? false
  );
  const [requiresConsumableCheck, setRequiresConsumableCheck] = useState(
    initialProduct?.requiresConsumableCheck ?? false
  );
  const [requiresInspection, setRequiresInspection] = useState(
    initialProduct?.requiresInspection ?? false
  );
  const [customPostJobRules, setCustomPostJobRules] = useState<string[]>(
    initialProduct?.customPostJobRules ?? []
  );

  // Author: Puran
  // Impact: Notes & Rules tab — three free-form text areas, one per
  //         audience (sales, warehouse, AI quote reviewer)
  // Reason: same controlled-component pattern as the other tabs.
  //         Empty input collapses to null in buildPayload() so the
  //         DB stores a real "no notes" state and the textarea
  //         placeholder shows on next load.
  const [salesNotes, setSalesNotes] = useState(
    initialProduct?.salesNotes ?? ""
  );
  const [warehouseNotes, setWarehouseNotes] = useState(
    initialProduct?.warehouseNotes ?? ""
  );
  const [aiRules, setAiRules] = useState(initialProduct?.aiRules ?? "");

  // ── Configuration tab state (Phase 2 — lifted from local) ──────────
  //
  // Author: Puran
  // Impact: every Configuration tab field is now owned by the parent
  //         form so buildPayload() can roll productType + pricingConfig
  //         + addonGroups + variants into the same save flow as the
  //         other tabs
  // Reason: §1-3 of the Configurable Product Pricing spec — the
  //         admin form must persist a real productType discriminator
  //         + the matching pricing rules. Local-state-only meant
  //         every save lost the configuration silently.

  /**
   * Maps the legacy ConfigurationTab local literal type to the
   * canonical backend ProductType. The legacy type is kept inside
   * the form's UI state because the existing card sub-components
   * still render against it; the conversion to the backend enum
   * happens at the network boundary inside `buildPayload()`.
   */
  const initialBackendType: ProductType =
    initialProduct?.productType ?? "STANDARD";

  const [productType, setProductType] = useState<ProductType>(initialBackendType);

  // Author: Puran
  // Impact: dimension-based pricing fields — held as display strings
  //         so the user can clear them without flipping to NaN
  // Reason: same convention as the Operational tab. Conversion to
  //         number / cents happens in buildPayload() against the
  //         shared `dollarStringToCents` helper.
  const initialDimConfig: Partial<DimensionBasedConfig> | null =
    initialProduct?.productType === "DIMENSION_BASED"
      ? (initialProduct.pricingConfig as DimensionBasedConfig | null)
      : null;

  const [dim1Label, setDim1Label] = useState(
    initialDimConfig?.dim1Label ?? "Width (m)"
  );
  const [dim2Label, setDim2Label] = useState(
    initialDimConfig?.dim2Label ?? "Length (m)"
  );
  const [dimMin, setDimMin] = useState(
    initialDimConfig?.dimMin !== undefined
      ? String(initialDimConfig.dimMin)
      : "3"
  );
  const [dimMax, setDimMax] = useState(
    initialDimConfig?.dimMax !== undefined
      ? String(initialDimConfig.dimMax)
      : "12"
  );
  const [dimStep, setDimStep] = useState(
    initialDimConfig?.dimStep !== undefined
      ? String(initialDimConfig.dimStep)
      : "1"
  );
  const [dimDefault1, setDimDefault1] = useState(
    initialDimConfig?.dimDefault1 !== undefined
      ? String(initialDimConfig.dimDefault1)
      : "3"
  );
  const [dimDefault2, setDimDefault2] = useState(
    initialDimConfig?.dimDefault2 !== undefined &&
      initialDimConfig.dimDefault2 !== null
      ? String(initialDimConfig.dimDefault2)
      : "3"
  );
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(
    initialDimConfig?.pricingMethod ?? "per_sqm"
  );
  // Author: Puran
  // Impact: rate is held as a user-facing dollar string so they can
  //         type "5.50". buildPayload converts to int cents via
  //         `dollarStringToCents`.
  // Reason: caveat #2 from sign-off — `ratePerSqmCents` is the
  //         storage unit but humans type dollars.
  const [ratePerSqmDollars, setRatePerSqmDollars] = useState(
    initialDimConfig?.ratePerSqmCents !== undefined
      ? (initialDimConfig.ratePerSqmCents / 100).toFixed(2).replace(/\.00$/, "")
      : "8"
  );
  const [minArea, setMinArea] = useState(
    initialDimConfig?.minArea !== undefined
      ? String(initialDimConfig.minArea)
      : "9"
  );
  const [minPrice, setMinPrice] = useState(
    initialDimConfig?.minPrice !== undefined
      ? String(initialDimConfig.minPrice)
      : "200"
  );

  // ── Variants (SIZE_VARIANT products) ────────────────────────────────
  //
  // Author: Puran
  // Impact: variant rows are held as a single string-keyed shape
  //         that distinguishes "existing in DB" (`id` set) from
  //         "newly added by user" (`id` is null). Save orchestration
  //         walks this list to decide POST / PATCH / DELETE.
  // Reason: matches the Phase 2 sign-off — parent first, children
  //         second. The form needs a way to track which rows
  //         existed before this edit session and which are new,
  //         so the variant CRUD knows whether to POST or PATCH.
  interface VariantDraft {
    /** Stable client key for React rendering — never sent to API */
    key: string;
    /** Server id when this variant already exists; null for new rows */
    id: string | null;
    label: string;
    description: string;
    /** Whole-dollar string */
    priceDay: string;
    priceHalfday: string;
    priceOvernight: string;
    /** Whole number string */
    quantity: string;
    skuSuffix: string;
    sortOrder: number;
    active: boolean;
  }

  const initialVariants: VariantDraft[] = (initialProduct?.variants ?? []).map(
    (v) => ({
      key: `v-${v.id}`,
      id: v.id,
      label: v.label,
      description: v.description ?? "",
      priceDay: String(v.priceDay),
      priceHalfday: v.priceHalfday !== null ? String(v.priceHalfday) : "",
      priceOvernight: v.priceOvernight !== null ? String(v.priceOvernight) : "",
      quantity: String(v.quantity),
      skuSuffix: v.skuSuffix ?? "",
      sortOrder: v.sortOrder,
      active: v.active,
    })
  );
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);
  // Track variant ids that existed at mount but were removed by the
  // user. handleSave fires DELETE for each one. Pure client state —
  // never sent in a request body.
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

  // ── Add-on groups + Configuration notes ─────────────────────────────
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>(
    initialProduct?.addonGroups ?? []
  );
  // Configuration notes are stored on the product's existing
  // `aiRules` field for V1 — no separate column. Keeping the
  // distinction would require another DB migration without buying
  // anything in V1, since both fields are currently free text and
  // the AI rules tab already exists for the same audience.
  // (When the AI quote reviewer ships, this gets a dedicated
  // column.)

  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Author: Puran
  // Impact: visible tab list rebuilds whenever the configurable
  //         toggle flips
  // Reason: Configuration tab is conditional — buildTabs() drops
  //         it from the array when configurable === false. The
  //         memo key is just `configurable` since the rest of the
  //         tab list is static.
  const tabs = useMemo(() => buildTabs(configurable), [configurable]);

  // Old Author: Puran
  // New Author: Puran
  // Impact: toggle handler now (a) flips configurable, (b) bounces
  //         the user off the Configuration tab if they were sitting
  //         on it and toggled OFF, and (c) keeps productType in sync
  //         with the toggle so a hidden Configuration tab can never
  //         leave a non-STANDARD productType orphaned
  // Reason: Configuration tab is conditional again. Three side
  //         effects in one handler — all event-driven, no useEffect,
  //         so the React no-setState-in-effect rule stays clean.
  //
  //   Toggle ON  → if productType is STANDARD, default to
  //                DIMENSION_BASED so the Configuration tab opens to
  //                a useful starting state instead of an empty
  //                Product type card.
  //   Toggle OFF → reset productType to STANDARD so the saved row
  //                matches the toggle. Bounce the user back to Basic
  //                Info if they were on the Configuration tab.
  const handleToggleConfigurable = () => {
    setConfigurable((prev) => {
      const next = !prev;
      if (next) {
        // Turning ON — pre-select DIMENSION_BASED if we're starting
        // from STANDARD so the Configuration tab has content.
        if (productType === "STANDARD") {
          setProductType("DIMENSION_BASED");
        }
      } else {
        // Turning OFF — reset to STANDARD and bounce off Configuration
        // if that's the current tab.
        if (productType !== "STANDARD") {
          setProductType("STANDARD");
        }
        if (activeTab === "configuration") {
          setActiveTab("basic");
        }
      }
      return next;
    });
  };

  // Memoized for the SKU + category subtitle line under the heading.
  // Author: Puran
  // Impact: subtitle now reads the canonical category name from the
  //         selected ProductCategory row instead of the free-text
  //         input value
  // Reason: keeps the header in lock-step with the combobox selection.
  //         Falls back to the legacy `initialProduct.category` string
  //         while the late-binding hydration effect is still resolving
  //         so the subtitle never flashes empty for a legacy product.
  const headerSubtitle = useMemo(() => {
    const categoryLabel =
      selectedCategory?.name ?? initialProduct?.category ?? "";
    const parts = [sku, categoryLabel].filter(Boolean);
    return parts.join(" · ");
  }, [sku, selectedCategory, initialProduct?.category]);

  // ── Action handlers ──────────────────────────────────────────────────

  const handleDiscard = () => {
    router.push("/dashboard/products");
  };

  // Author: Puran
  // Impact: shared payload builder for both create and update
  // Reason: keeps the field-by-field mapping in one place so a typo
  //         can't put a value into create's body but miss update's.
  //         Whitespace is trimmed once here, optional fields collapse
  //         to null/undefined so the server's Zod schema accepts them.
  //
  // Numeric helpers:
  //   - `intOrZero` is for fields the DB stores with `default 0`
  //     (setup/packdown minutes, staff counts) — empty input means 0
  //   - `floatOrNull` is for nullable Float columns (dimensions, weight)
  //     — empty input stays null so the editor shows the placeholder
  //   - `intOrNull`  is for nullable Int columns (truck space)
  const intOrZero = (s: string): number => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const floatOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const intOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // Author: Puran
  // Impact: payload sends the resolved categoryId (preferred) plus
  //         the canonical name on the legacy `category` field for the
  //         dual-write rollout. Server-side route resolves either
  //         field; once the legacy column is dropped this drops the
  //         category string and only categoryId remains.
  // Reason: aligns with the create/update Zod schemas which accept
  //         both fields and require at least one on create.
  // Author: Puran
  // Impact: pricingConfig is GATED on the current productType — when
  //         the user is on STANDARD / SIZE_VARIANT / QUANTITY_ADDONS,
  //         this returns null regardless of any leftover dimension
  //         state in local memory
  // Reason: Phase 2 caveat from sign-off — never persist a half-built
  //         dimension config because the user flipped types mid-edit.
  //         Single source of truth: the current productType picks
  //         the JSON shape sent to the API.
  const buildPricingConfig = (): DimensionBasedConfig | null => {
    if (productType !== "DIMENSION_BASED") return null;
    return {
      dim1Label: dim1Label.trim() || "Width (m)",
      dim2Label: dim2Label.trim() || null,
      dimMin: parseFloat(dimMin) || 0,
      dimMax: parseFloat(dimMax) || 0,
      dimStep: parseFloat(dimStep) || 1,
      dimDefault1: parseFloat(dimDefault1) || 0,
      dimDefault2: dimDefault2 ? parseFloat(dimDefault2) : null,
      pricingMethod,
      // Only the per_sqm fields are wired in V1 — flat_tier and
      // base_plus_sqm UI is part of the future "Pricing method" enum
      // expansion. The Zod schema accepts the other methods so the
      // contract is forward-compatible; the form just doesn't expose
      // them yet.
      ratePerSqmCents:
        pricingMethod === "per_sqm"
          ? dollarStringToCents(ratePerSqmDollars) ?? 0
          : undefined,
      minArea: parseFloat(minArea) || 0,
      minPrice: parseFloat(minPrice) || 0,
    };
  };

  const buildPayload = (): CreateProductInput => ({
    name: name.trim(),
    sku: sku.trim(),
    categoryId: selectedCategory?.id,
    category: selectedCategory?.name,
    subcategory: subcategory.trim() || null,
    description: description.trim() || null,
    configurable,
    // Author: Puran
    // Impact: Configuration tab fields — productType discriminator,
    //         the model-specific pricingConfig (or null), and the
    //         add-on groups list
    // Reason: §1-3 of the Configurable Product Pricing spec.
    //         pricingConfig is computed via buildPricingConfig()
    //         which gates on the current productType so a stale
    //         dimension state can't survive a type switch.
    productType,
    pricingConfig: buildPricingConfig(),
    addonGroups,
    status,
    // Operational tab
    setupMinutes: intOrZero(setupMinutes),
    packdownMinutes: intOrZero(packdownMinutes),
    staffSetup: intOrZero(staffSetup),
    staffOperate: intOrZero(staffOperate),
    lengthM: floatOrNull(lengthM),
    widthM: floatOrNull(widthM),
    heightM: floatOrNull(heightM),
    weightKg: floatOrNull(weightKg),
    truckSpaceUnits: intOrNull(truckSpaceUnits),
    handlingFlags,
    // Warehouse tab — empty strings collapse to null so the DB stores
    // a real "no value" state instead of the empty string
    warehouseZone: warehouseZone.trim() || null,
    warehouseBayShelf: warehouseBayShelf.trim() || null,
    warehouseLocationNotes: warehouseLocationNotes.trim() || null,
    requiresCleaning,
    requiresCharging,
    requiresConsumableCheck,
    requiresInspection,
    customPostJobRules,
    // Notes & Rules tab — empty textareas collapse to null so the DB
    // stores a real "no notes" state instead of the empty string
    salesNotes: salesNotes.trim() || null,
    warehouseNotes: warehouseNotes.trim() || null,
    aiRules: aiRules.trim() || null,
    images,
    tags,
  });

  // Author: Puran
  // Impact: orchestrates the variant CRUD pass that runs after a
  //         successful parent product save
  // Reason: Phase 2 sign-off — parent first, children second. New
  //         drafts (id === null) become POSTs, existing drafts
  //         (id !== null) become PATCHes for any field that
  //         changed, and `deletedVariantIds` become DELETEs. All
  //         three lists run in parallel via Promise.allSettled so
  //         one failure doesn't cancel the others; the caller
  //         shows a per-failure toast.
  //
  // Returns the list of error messages — empty array means full
  // success. The caller refetches the product detail unconditionally
  // so the UI matches DB regardless of partial failure.
  const syncVariants = async (
    productId: string
  ): Promise<{ errors: string[] }> => {
    const errors: string[] = [];

    // 1. DELETE first so a re-add of the same label doesn't collide
    //    with the soft-deleted row's @@unique([productId, label])
    //    on the new POST below.
    const deleteResults = await Promise.allSettled(
      deletedVariantIds.map((variantId) =>
        apiClient.del(
          `/api/orgs/current/products/${productId}/variants/${variantId}`
        )
      )
    );
    deleteResults.forEach((r, idx) => {
      if (r.status === "rejected") {
        const id = deletedVariantIds[idx];
        const message =
          r.reason instanceof Error ? r.reason.message : "Failed to delete";
        errors.push(`Delete variant ${id}: ${message}`);
      }
    });

    // 2. POST new variants and PATCH existing ones in parallel.
    //    We resolve each draft to one network call so a single
    //    Promise.allSettled covers both kinds.
    const upsertResults = await Promise.allSettled(
      variants.map((draft) => {
        const body: CreateVariantInput | UpdateVariantInput = {
          label: draft.label.trim(),
          description: draft.description.trim() || null,
          priceDay: parseInt(draft.priceDay, 10) || 0,
          priceHalfday: draft.priceHalfday
            ? parseInt(draft.priceHalfday, 10)
            : null,
          priceOvernight: draft.priceOvernight
            ? parseInt(draft.priceOvernight, 10)
            : null,
          quantity: parseInt(draft.quantity, 10) || 0,
          skuSuffix: draft.skuSuffix.trim() || null,
          sortOrder: draft.sortOrder,
          active: draft.active,
        };
        if (draft.id) {
          return apiClient.patch(
            `/api/orgs/current/products/${productId}/variants/${draft.id}`,
            body
          );
        }
        return apiClient.post(
          `/api/orgs/current/products/${productId}/variants`,
          body
        );
      })
    );
    upsertResults.forEach((r, idx) => {
      if (r.status === "rejected") {
        const draft = variants[idx];
        const message =
          r.reason instanceof Error ? r.reason.message : "Failed to save";
        errors.push(`${draft.label || "Untitled variant"}: ${message}`);
      }
    });

    return { errors };
  };

  // Author: Puran
  // Impact: structured client-side validation that runs on every save
  //         attempt. Returns a `{ errors, firstErrorTab }` object the
  //         caller uses to (a) auto-switch to the tab containing the
  //         first broken field, (b) surface per-field errors inline
  //         via `formErrors[fieldKey]`, and (c) show a single summary
  //         toast instead of three sequential returns.
  // Reason: catches the obvious cases before burning a network
  //         round-trip + lands the user next to the broken field
  //         instead of making them hunt for it. The server's Zod
  //         remains the authoritative validator (PROJECT_RULES.md
  //         §4.6) — this is the friendly client-side first pass.
  //
  // Field-key convention: dot-path matching the form state slice
  // (e.g. "basic.name", "config.ratePerSqm", "variants.0.label").
  // The Input components read from `formErrors[fieldKey]` and pass
  // it through to their existing `error` prop.
  const validateForm = (): {
    errors: Record<string, string>;
    firstErrorTab: TabId | null;
  } => {
    const errors: Record<string, string> = {};
    let firstErrorTab: TabId | null = null;

    // Helper that records an error AND remembers which tab the
    // first error sits on, so we can auto-switch the user there.
    const fail = (key: string, message: string, tab: TabId) => {
      if (errors[key]) return; // first message wins per field
      errors[key] = message;
      if (firstErrorTab === null) firstErrorTab = tab;
    };

    // ── Basic Info ────────────────────────────────────────────────
    if (!name.trim()) {
      fail("basic.name", "Product name is required.", "basic");
    } else if (name.trim().length > 200) {
      fail("basic.name", "Name must be 200 characters or less.", "basic");
    }

    if (!sku.trim()) {
      fail("basic.sku", "SKU is required.", "basic");
    } else if (sku.trim().length > 80) {
      fail("basic.sku", "SKU must be 80 characters or less.", "basic");
    }

    if (!selectedCategory) {
      fail(
        "basic.category",
        "Pick or add a category before saving.",
        "basic"
      );
    }

    if (subcategory.trim().length > 80) {
      fail(
        "basic.subcategory",
        "Subcategory must be 80 characters or less.",
        "basic"
      );
    }

    if (description.trim().length > 2000) {
      fail(
        "basic.description",
        "Description must be 2000 characters or less.",
        "basic"
      );
    }

    if (tags.length > 30) {
      fail("basic.tags", "A product can have at most 30 tags.", "basic");
    }

    // ── Configuration tab — only validate the active model ───────
    if (configurable && productType === "DIMENSION_BASED") {
      // Dimension labels — at least dim1 must be present
      if (!dim1Label.trim()) {
        fail(
          "config.dim1Label",
          "Dimension 1 label is required.",
          "configuration"
        );
      }

      // Min/Max numeric validity + ordering invariant
      const minN = parseFloat(dimMin);
      const maxN = parseFloat(dimMax);
      if (!Number.isFinite(minN) || minN < 0) {
        fail("config.dimMin", "Min value must be ≥ 0.", "configuration");
      }
      if (!Number.isFinite(maxN) || maxN < 0) {
        fail("config.dimMax", "Max value must be ≥ 0.", "configuration");
      }
      if (
        Number.isFinite(minN) &&
        Number.isFinite(maxN) &&
        minN > maxN
      ) {
        fail(
          "config.dimMax",
          "Max value must be greater than or equal to Min value.",
          "configuration"
        );
      }

      // Step size — must be positive
      const stepN = parseFloat(dimStep);
      if (!Number.isFinite(stepN) || stepN <= 0) {
        fail(
          "config.dimStep",
          "Step size must be greater than 0.",
          "configuration"
        );
      }

      // Defaults must sit inside [min, max]
      const def1N = parseFloat(dimDefault1);
      if (!Number.isFinite(def1N)) {
        fail(
          "config.dimDefault1",
          "Default value 1 is required.",
          "configuration"
        );
      } else if (
        Number.isFinite(minN) &&
        Number.isFinite(maxN) &&
        (def1N < minN || def1N > maxN)
      ) {
        fail(
          "config.dimDefault1",
          "Default must be between min and max.",
          "configuration"
        );
      }

      if (dimDefault2.trim() !== "") {
        const def2N = parseFloat(dimDefault2);
        if (!Number.isFinite(def2N)) {
          fail(
            "config.dimDefault2",
            "Default value 2 must be a number.",
            "configuration"
          );
        } else if (
          Number.isFinite(minN) &&
          Number.isFinite(maxN) &&
          (def2N < minN || def2N > maxN)
        ) {
          fail(
            "config.dimDefault2",
            "Default must be between min and max.",
            "configuration"
          );
        }
      }

      // Per-sqm specific — only the per_sqm input cluster is wired
      // in V1, so only its required fields get validated here.
      if (pricingMethod === "per_sqm") {
        const cents = dollarStringToCents(ratePerSqmDollars);
        if (cents === null || cents < 0) {
          fail(
            "config.ratePerSqm",
            "Rate per sqm must be a positive number.",
            "configuration"
          );
        }
        const minAreaN = parseFloat(minArea);
        if (
          minArea.trim() !== "" &&
          (!Number.isFinite(minAreaN) || minAreaN < 0)
        ) {
          fail(
            "config.minArea",
            "Minimum area must be ≥ 0.",
            "configuration"
          );
        }
        const minPriceN = parseFloat(minPrice);
        if (
          minPrice.trim() !== "" &&
          (!Number.isFinite(minPriceN) || minPriceN < 0)
        ) {
          fail(
            "config.minPrice",
            "Minimum price must be ≥ 0.",
            "configuration"
          );
        }
      }
    }

    // ── Variants (SIZE_VARIANT only) ──────────────────────────────
    if (configurable && productType === "SIZE_VARIANT" && !isCreate) {
      if (variants.length === 0) {
        fail(
          "variants",
          "Add at least one variant before saving.",
          "configuration"
        );
      }
      // Per-variant + duplicate-label check
      const seenLabels = new Set<string>();
      variants.forEach((v, idx) => {
        const trimmed = v.label.trim();
        if (!trimmed) {
          fail(
            `variants.${idx}.label`,
            "Variant label is required.",
            "configuration"
          );
        } else {
          const slug = trimmed.toLowerCase();
          if (seenLabels.has(slug)) {
            fail(
              `variants.${idx}.label`,
              "Two variants can't share the same label.",
              "configuration"
            );
          }
          seenLabels.add(slug);
        }
        const day = parseInt(v.priceDay, 10);
        if (!Number.isFinite(day) || day < 0) {
          fail(
            `variants.${idx}.priceDay`,
            "Day rate must be ≥ 0.",
            "configuration"
          );
        }
        const qty = parseInt(v.quantity, 10);
        if (!Number.isFinite(qty) || qty < 0) {
          fail(
            `variants.${idx}.quantity`,
            "Quantity must be ≥ 0.",
            "configuration"
          );
        }
      });
    }

    // ── Add-on groups — every group + option label must be filled
    addonGroups.forEach((group, gIdx) => {
      if (!group.label.trim()) {
        fail(
          `addonGroups.${gIdx}.label`,
          "Group label is required.",
          "configuration"
        );
      }
      group.options.forEach((opt, oIdx) => {
        if (!opt.label.trim()) {
          fail(
            `addonGroups.${gIdx}.options.${oIdx}.label`,
            "Option label is required.",
            "configuration"
          );
        }
        if (opt.price < 0) {
          fail(
            `addonGroups.${gIdx}.options.${oIdx}.price`,
            "Option price must be ≥ 0.",
            "configuration"
          );
        }
      });
    });

    // ── Notes & Rules text caps ──────────────────────────────────
    if (salesNotes.length > 5000) {
      fail(
        "notes.salesNotes",
        "Sales notes must be 5000 characters or less.",
        "notes"
      );
    }
    if (warehouseNotes.length > 5000) {
      fail(
        "notes.warehouseNotes",
        "Warehouse notes must be 5000 characters or less.",
        "notes"
      );
    }
    if (aiRules.length > 5000) {
      fail(
        "notes.aiRules",
        "AI product rules must be 5000 characters or less.",
        "notes"
      );
    }

    return { errors, firstErrorTab };
  };

  // Author: Puran
  // Impact: per-field error map surfaced inline next to broken inputs
  // Reason: complements the summary toast in handleSave — the user
  //         gets red helper text under each broken field via the
  //         existing Input `error` prop. The map is wiped on every
  //         save attempt so stale errors don't linger.
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    if (isSaving) return;

    // Author: Puran
    // Impact: validation produces (a) inline red field errors via
    //         formErrors, (b) auto-tab-switch to the first broken
    //         field's tab, AND (c) a friendly summary toast that
    //         tells the user where to look — the toast names the
    //         first broken field by label so the user knows what to
    //         fix without having to read every red helper line.
    // Reason: previous version did three sequential toasts which
    //         was spammy. This version is one toast that names the
    //         specific issue (or a count when there are several),
    //         with the inline borders doing the per-field detail
    //         work. Standard form UX — modern form libraries do
    //         exactly this pattern.
    const { errors: validationErrors, firstErrorTab } = validateForm();
    const errorCount = Object.keys(validationErrors).length;
    if (errorCount > 0) {
      setFormErrors(validationErrors);
      if (firstErrorTab && firstErrorTab !== activeTab) {
        setActiveTab(firstErrorTab);
      }
      // Friendly summary toast — single, descriptive, actionable.
      // For 1 error: "Product name is required." (the actual message)
      // For 2+ errors: "Please fix 3 issues — see the highlighted fields."
      const firstErrorMessage = Object.values(validationErrors)[0];
      toast.error(
        errorCount === 1
          ? firstErrorMessage
          : `Please fix ${errorCount} issues — check the highlighted fields.`
      );
      return;
    }
    // Clear any prior errors now that the form is clean.
    setFormErrors({});

    if (isCreate) {
      // Author: Puran
      // Impact: create flow does NOT run variant sync — variants
      //         need a parent id, so the user adds them on the
      //         second pass after the form navigates to /edit/[id]
      // Reason: Phase 2 guardrail from sign-off — variants UI is
      //         disabled in create mode and the Configuration tab
      //         shows a "save the product first" empty state on the
      //         Size variants card.
      createProduct.mutate(buildPayload(), {
        onSuccess: (created) => {
          toast.success(`"${created.name}" created.`);
          router.push(`/dashboard/products/${created.id}/edit`);
        },
        onError: (err) => {
          toast.error(err.message);
        },
      });
      return;
    }

    // Edit mode — partial PATCH for the parent product, then the
    // variant sync if the parent succeeded. The two phases are
    // sequenced (NOT parallel) so a parent failure cancels the
    // variant pass per the sign-off guardrail #1.
    const payload: UpdateProductInput = buildPayload();
    updateProduct.mutate(payload, {
      onSuccess: async (updated) => {
        // Run the variant sync. Errors are collected per-variant
        // and surfaced in a single toast — no auto-rollback,
        // matches sign-off guardrail #2.
        const { errors: variantErrors } = await syncVariants(updated.id);

        if (variantErrors.length === 0) {
          toast.success(`"${updated.name}" saved.`);
          // Clear the deleted-id buffer on success so the next save
          // doesn't try to re-delete rows that are already gone.
          setDeletedVariantIds([]);
          return;
        }

        // Partial failure: tell the user exactly which variants
        // failed and ask them to retry. The product detail cache
        // is invalidated by the variant hooks (and re-fetched by
        // the React Query subscriber on the edit page), so the
        // form re-hydrates with the DB truth on the next render.
        toast.error(
          `Saved "${updated.name}", but ${variantErrors.length} variant ${
            variantErrors.length === 1 ? "change" : "changes"
          } failed: ${variantErrors.join("; ")}`
        );
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
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

  // ── Configuration tab handlers ──────────────────────────────────────

  // Author: Puran
  // Impact: variant CRUD helpers — operate on the local VariantDraft
  //         list, NOT the API. The API mutations fire from
  //         handleSave after the parent product save commits.
  // Reason: parent-first / children-second pattern from the sign-off.
  //         Local edits are batched until Save Changes is clicked.

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        key: `v-new-${Date.now().toString(36)}`,
        id: null,
        label: "",
        description: "",
        priceDay: "0",
        priceHalfday: "",
        priceOvernight: "",
        quantity: "1",
        skuSuffix: "",
        sortOrder: prev.length,
        active: true,
      },
    ]);
  };

  const handleVariantChange = (
    key: string,
    patch: Partial<VariantDraft>
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.key === key ? { ...v, ...patch } : v))
    );
  };

  const handleRemoveVariant = (key: string) => {
    setVariants((prev) => {
      const target = prev.find((v) => v.key === key);
      // If the variant has a server id, remember it so handleSave
      // can fire DELETE for it. New rows that were never saved are
      // just dropped from local state.
      if (target?.id) {
        setDeletedVariantIds((d) => [...d, target.id!]);
      }
      return prev.filter((v) => v.key !== key);
    });
  };

  // Add-on group helpers — operate on the lifted addonGroups state.
  // These mirror the helpers that used to live inside ConfigurationTab,
  // just promoted to the parent so the data flows through buildPayload.
  const handleAddonGroupChange = (
    groupId: string,
    patch: Partial<AddonGroup>
  ) => {
    setAddonGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g))
    );
  };

  const handleAddAddonGroup = () => {
    setAddonGroups((prev) => [
      ...prev,
      {
        id: `g-${Date.now().toString(36)}`,
        label: "",
        selectionType: "any",
        customerVisible: true,
        sortOrder: prev.length,
        options: [],
      },
    ]);
  };

  const handleRemoveAddonGroup = (groupId: string) => {
    setAddonGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleAddonOptionChange = (
    groupId: string,
    optionId: string,
    patch: Partial<AddonOption>
  ) => {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: g.options.map((o) =>
                o.id === optionId ? { ...o, ...patch } : o
              ),
            }
      )
    );
  };

  const handleAddAddonOption = (groupId: string) => {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: [
                ...g.options,
                {
                  id: `o-${Date.now().toString(36)}`,
                  label: "",
                  description: "",
                  price: 0,
                  pricingUnit: "flat",
                  sortOrder: g.options.length,
                  active: true,
                },
              ],
            }
      )
    );
  };

  const handleRemoveAddonOption = (groupId: string, optionId: string) => {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, options: g.options.filter((o) => o.id !== optionId) }
      )
    );
  };

  // Author: Puran
  // Impact: live pricing preview computed via the shared helper
  // Reason: §4 of the pricing spec — same math file the future
  //         quote builder will import, so the admin preview and
  //         the sales-facing price are guaranteed to agree. The
  //         memo only re-runs when the dimension fields actually
  //         change.
  const dimensionPreview = useMemo(() => {
    if (productType !== "DIMENSION_BASED") return [];
    // Build a partial config from the current form state. Missing /
    // invalid fields fall through to 0 inside computeDimensionPrice
    // — the preview shouldn't render NaN while the user is mid-edit.
    const config: DimensionBasedConfig = {
      dim1Label,
      dim2Label: dim2Label || null,
      dimMin: parseFloat(dimMin) || 0,
      dimMax: parseFloat(dimMax) || 0,
      dimStep: parseFloat(dimStep) || 1,
      dimDefault1: parseFloat(dimDefault1) || 0,
      dimDefault2: dimDefault2 ? parseFloat(dimDefault2) : null,
      pricingMethod,
      ratePerSqmCents:
        pricingMethod === "per_sqm"
          ? dollarStringToCents(ratePerSqmDollars) ?? 0
          : undefined,
      minArea: parseFloat(minArea) || 0,
      minPrice: parseFloat(minPrice) || 0,
    };
    return computeDimensionPreview(config);
  }, [
    productType,
    dim1Label,
    dim2Label,
    dimMin,
    dimMax,
    dimStep,
    dimDefault1,
    dimDefault2,
    pricingMethod,
    ratePerSqmDollars,
    minArea,
    minPrice,
  ]);

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
          <Button
            variant="outline"
            size="md"
            onClick={handleDiscard}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={isSaving}
          >
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
        {tabs.map((tab) => {
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
                error={formErrors["basic.name"]}
              />
              <Input
                label="SKU / Product code"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SKU-001"
                error={formErrors["basic.sku"]}
              />

              {/* Old Author: Puran */}
              {/* New Author: Puran */}
              {/* Impact: Category is now a Combobox backed by a per-org */}
              {/*         master list (ProductCategory). Search filters */}
              {/*         existing categories; typing a name that doesn't */}
              {/*         exist surfaces a "+ Add" row that creates the */}
              {/*         category in the same flow. */}
              {/* Reason: previous free-text Input meant every quote, */}
              {/*         report, and filter had to handle "Inflatable" */}
              {/*         vs "inflatable" vs "Inflatables" as different */}
              {/*         buckets. Promoting to a master list with case- */}
              {/*         insensitive uniqueness fixes that without */}
              {/*         forcing the org to fit a fixed taxonomy — they */}
              {/*         still own their own list. */}
              <Combobox<ProductCategory>
                label="Category"
                value={selectedCategory}
                onChange={handleCategoryChange}
                options={categories}
                getOptionId={(c) => c.id}
                getOptionLabel={(c) => c.name}
                placeholder="Select or add a category"
                loading={categoriesLoading}
                error={formErrors["basic.category"]}
                emptyMessage="No categories yet. Type a name and click + to add your first."
                onCreate={async (newName) => {
                  // Server resurrects soft-deleted rows with the same
                  // slug, so this also handles the "I just deleted
                  // 'Inflatable' and want it back" case.
                  try {
                    const created = await createCategory.mutateAsync({
                      name: newName,
                    });
                    return created;
                  } catch (err) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "Failed to create category.";
                    toast.error(message);
                    throw err;
                  }
                }}
                createLabel={(input) => `+ Add "${input}"`}
              />
              <Input
                label="Subcategory (Optional)"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Enter"
                error={formErrors["basic.subcategory"]}
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
                className={[
                  "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors resize-y min-h-25",
                  formErrors["basic.description"]
                    ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-300"
                    : "border-gray-200 focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20",
                ].join(" ")}
              />
              {formErrors["basic.description"] && (
                <p className="text-xs text-red-500">
                  {formErrors["basic.description"]}
                </p>
              )}
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

            <div className="mt-4">
              <ProductImagesUploader value={images} onChange={setImages} />
            </div>
          </Card>

          {/* Tags card */}
          {/* Old Author: Puran */}
          {/* New Author: Puran */}
          {/* Impact: tag chips and the Add Tag pill now match the */}
          {/*         Figma — bigger pills (h-10), normal text (text-sm) */}
          {/*         not text-xs, slate × icon, and the Add Tag pill */}
          {/*         uses the brand `blue` token (#0062FF) for the */}
          {/*         border, text, and + icon with a light blue fill */}
          {/* Reason: previous chips were too small and the Add Tag */}
          {/*         pill was on the dark navy palette instead of the */}
          {/*         brand blue the Figma calls for. Single design- */}
          {/*         token source — same #0062FF used by info banners, */}
          {/*         selected Product type cards, and pricing preview */}
          {/*         numbers. */}
          <Card padding="md">
            <p className="text-sm font-semibold text-slate-900">Tags</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-700 transition-colors hover:text-slate-900 cursor-pointer"
                    aria-label={`Remove tag ${tag}`}
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
                </span>
              ))}
              {/* Add Tag pill — brand-blue outline + light fill, with
                  an inline input that grows with the typed text. The
                  pill itself is the same h-10 size as the saved tags
                  so the row reads as a single family. */}
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-blue bg-blue-50 px-5 text-blue">
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
                  className="w-16 sm:w-20 bg-transparent text-sm font-medium text-blue placeholder:text-blue outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="flex items-center justify-center text-blue cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="Add tag"
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
        <InventoryTab productType={productType} />
      ) : activeTab === "operational" ? (
        <OperationalTab
          setupMinutes={setupMinutes}
          onChangeSetupMinutes={setSetupMinutes}
          packdownMinutes={packdownMinutes}
          onChangePackdownMinutes={setPackdownMinutes}
          staffSetup={staffSetup}
          onChangeStaffSetup={setStaffSetup}
          staffOperate={staffOperate}
          onChangeStaffOperate={setStaffOperate}
          lengthM={lengthM}
          onChangeLengthM={setLengthM}
          widthM={widthM}
          onChangeWidthM={setWidthM}
          heightM={heightM}
          onChangeHeightM={setHeightM}
          weightKg={weightKg}
          onChangeWeightKg={setWeightKg}
          truckSpaceUnits={truckSpaceUnits}
          onChangeTruckSpaceUnits={setTruckSpaceUnits}
          handlingFlags={handlingFlags}
          onChangeHandlingFlags={setHandlingFlags}
        />
      ) : activeTab === "warehouse" ? (
        <WarehouseTab
          warehouseZone={warehouseZone}
          onChangeWarehouseZone={setWarehouseZone}
          warehouseBayShelf={warehouseBayShelf}
          onChangeWarehouseBayShelf={setWarehouseBayShelf}
          warehouseLocationNotes={warehouseLocationNotes}
          onChangeWarehouseLocationNotes={setWarehouseLocationNotes}
          requiresCleaning={requiresCleaning}
          onChangeRequiresCleaning={setRequiresCleaning}
          requiresCharging={requiresCharging}
          onChangeRequiresCharging={setRequiresCharging}
          requiresConsumableCheck={requiresConsumableCheck}
          onChangeRequiresConsumableCheck={setRequiresConsumableCheck}
          requiresInspection={requiresInspection}
          onChangeRequiresInspection={setRequiresInspection}
          customPostJobRules={customPostJobRules}
          onChangeCustomPostJobRules={setCustomPostJobRules}
        />
      ) : activeTab === "notes" ? (
        <NotesRulesTab
          salesNotes={salesNotes}
          onChangeSalesNotes={setSalesNotes}
          warehouseNotes={warehouseNotes}
          onChangeWarehouseNotes={setWarehouseNotes}
          aiRules={aiRules}
          onChangeAiRules={setAiRules}
        />
      ) : activeTab === "configuration" ? (
        <ConfigurationTab
          isCreate={isCreate}
          productType={productType}
          onChangeProductType={setProductType}
          dim1Label={dim1Label}
          onChangeDim1Label={setDim1Label}
          dim2Label={dim2Label}
          onChangeDim2Label={setDim2Label}
          dimMin={dimMin}
          onChangeDimMin={setDimMin}
          dimMax={dimMax}
          onChangeDimMax={setDimMax}
          dimStep={dimStep}
          onChangeDimStep={setDimStep}
          dimDefault1={dimDefault1}
          onChangeDimDefault1={setDimDefault1}
          dimDefault2={dimDefault2}
          onChangeDimDefault2={setDimDefault2}
          pricingMethod={pricingMethod}
          onChangePricingMethod={setPricingMethod}
          ratePerSqmDollars={ratePerSqmDollars}
          onChangeRatePerSqmDollars={setRatePerSqmDollars}
          minArea={minArea}
          onChangeMinArea={setMinArea}
          minPrice={minPrice}
          onChangeMinPrice={setMinPrice}
          pricingPreview={dimensionPreview}
          variants={variants}
          onAddVariant={handleAddVariant}
          onChangeVariant={handleVariantChange}
          onRemoveVariant={handleRemoveVariant}
          addonGroups={addonGroups}
          onAddAddonGroup={handleAddAddonGroup}
          onChangeAddonGroup={handleAddonGroupChange}
          onRemoveAddonGroup={handleRemoveAddonGroup}
          onAddAddonOption={handleAddAddonOption}
          onChangeAddonOption={handleAddonOptionChange}
          onRemoveAddonOption={handleRemoveAddonOption}
        />
      ) : (
        <ComingSoonTab
          tabLabel={tabs.find((t) => t.id === activeTab)?.label ?? ""}
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
