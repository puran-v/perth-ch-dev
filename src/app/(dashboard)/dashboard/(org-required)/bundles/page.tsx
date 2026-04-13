"use client";

/**
 * Bundles & Packages page — Module A step 5 of the org-setup flow.
 *
 * Shows pre-grouped product bundles: a header with description, an info
 * banner explaining locked vs flexible bundles, a "Packages" table, and
 * an inline "New bundle" form that slides in when "+ Create bundle" is
 * clicked. The footer Save / Next: Quote Templates row continues the
 * setup flow from the Products page.
 *
 * Backend status: the Bundle model and /api/orgs/current/bundles endpoint
 * do NOT exist yet. The page renders against MOCK_BUNDLES defined below
 * and is structured so wiring `useBundles()` later is a single import
 * swap. Every action button is a stub toast — no silent failures.
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */

// Author: samir
// Impact: replaced the stub h1 with full Figma layout — info banner,
//         packages table, inline create bundle form, setup-flow nav
// Reason: this is Module A step 5 after Products. UI ships first;
//         backend follows.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

// ─── Types ─────────────────────────────────────────────────────────────

/** Bundle type: Flexible bundles can be modified on a quote; Locked cannot. */
type BundleType = "FLEXIBLE" | "LOCKED";

/** Pricing method for the bundle. */
type BundlePricingMethod = "HOURLY" | "TIERED" | "DAILY" | "CUSTOM";

/** Custom tier row used when pricing method is CUSTOM. */
interface CustomTier {
  id: string;
  tierType: string; // FIRST | NEXT | AFTER — label text in the dropdown
  hours: string;
  price: string;
}

/** Row shape for the packages table. */
interface BundleRow {
  id: string;
  name: string;
  itemCount: number;
  itemsIncluded: string;
  bundlePrice: number;
  savings: number;
  type: BundleType;
  suggestedFor: string;
}

// ─── Mock data ─────────────────────────────────────────────────────────

const MOCK_BUNDLES: BundleRow[] = [
  {
    id: "bnd-001",
    name: "Kids Party Starter",
    itemCount: 3,
    itemsIncluded: "Big Blue Castle, Snow Cone Machine, Face Painting Kit",
    bundlePrice: 480,
    savings: 60,
    type: "FLEXIBLE",
    suggestedFor: "Kids birthday",
  },
  {
    id: "bnd-002",
    name: "Corporate Event Pack",
    itemCount: 4,
    itemsIncluded: "Axe Throwing x2, Pedal Kart Set, Silent Disco Kit",
    bundlePrice: 980,
    savings: 60,
    type: "LOCKED",
    suggestedFor: "Corporate, team building",
  },
  {
    id: "bnd-003",
    name: "Kids Party Starter",
    itemCount: 3,
    itemsIncluded: "Big Blue Castle, Snow Cone Machine, Face Painting Kit",
    bundlePrice: 480,
    savings: 60,
    type: "FLEXIBLE",
    suggestedFor: "Kids birthday",
  },
];

// ─── Mock products list for the "Products included" selector ───────────

const MOCK_PRODUCTS = [
  { name: "Big Blue Castle", price: 280 },
  { name: "Bungee Trampoline", price: 650 },
  { name: "Axe Throwing Station", price: 180 },
  { name: "Dunk Tank", price: 320 },
  { name: "Silent Disco Kit", price: null },
  { name: "Pedal Kart Set", price: 220 },
];

// ─── Page entry ────────────────────────────────────────────────────────

export default function BundlesPage() {
  return (
    <ModuleGuard module="A">
      <BundlesCatalogue />
    </ModuleGuard>
  );
}

// ─── Catalogue body ────────────────────────────────────────────────────

/**
 * Renders the full Bundles & Packages layout inside the ModuleGuard.
 * Split out so the guard layer stays thin.
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */
function BundlesCatalogue() {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Author: samir
  // Impact: mock data until backend exists
  // Reason: UI-first approach — real hook swap is a single import change
  const bundles: BundleRow[] = useMemo(() => MOCK_BUNDLES, []);

  // ── Action handlers ──────────────────────────────────────────────────

  const handleCreateBundle = () => {
    setShowCreateForm(true);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
  };

  const handleEdit = (bundle: BundleRow) => {
    toast.info(`Edit bundle: ${bundle.name} — coming soon.`);
  };

  // Author: samir
  // Impact: folded the inline New-bundle form's Save draft / Save bundle
  //         actions into the page-level footer row, mirroring the Teams
  //         and Org Setup pages' Save & Draft / Save & Continue pair
  // Reason: duplicate action rows made the scope of each button unclear
  //         and drifted from the rest of the setup-flow. Single footer
  //         row is the house pattern.
  const handleSaveDraft = () => {
    toast.success(
      showCreateForm ? "Bundle saved as draft." : "Bundles saved as draft."
    );
    setShowCreateForm(false);
  };

  const handleSaveContinue = () => {
    toast.success(showCreateForm ? "Bundle saved." : "Bundles saved.");
    setShowCreateForm(false);
    router.push("/dashboard/quote-templates");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Bundles &amp; Packages
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pre-grouped sets of products. Sales team can add a bundle to a quote
          with one click.
        </p>
      </div>

      {/* Info banner — locked vs flexible explanation */}
      <InfoBanner />

      {/* Packages card */}
      <Card padding="none">
        {/* Card header — "Packages" left, "+ Create bundle" right */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">Packages</h2>
          <Button variant="primary" size="sm" onClick={handleCreateBundle}>
            + Create bundle
          </Button>
        </div>

        {/* Body — empty state OR table+cards */}
        {bundles.length === 0 ? (
          <EmptyState
            title="No bundles yet"
            description="Create your first bundle to offer pre-grouped products on quotes."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateBundle}
              >
                + Create bundle
              </Button>
            }
          />
        ) : (
          // Author: samir
          // Impact: replaced the xl+ table / mobile cards dual-layout with
          //         a single <table> that horizontally scrolls on smaller
          //         viewports. Same visual language at every breakpoint.
          // Reason: user wants the bundles list to stay a table on mobile
          //         instead of collapsing into stacked cards.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-black">
                <tr className="font-medium">
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">Bundle name</th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">
                    Items included
                  </th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">Bundle price</th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">Savings</th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">Type</th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3">Suggested for</th>
                  <th className="whitespace-nowrap font-medium text-black px-6 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bundles.map((b) => (
                  <tr key={b.id} className="font-normal hover:bg-slate-50/40">
                    <td className="px-6 py-4">
                      <p className="text-sm font-normal text-slate-600">
                        {b.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {b.itemCount} items
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[280px]">
                      {b.itemsIncluded}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      ${b.bundlePrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <SavingsPill savings={b.savings} />
                    </td>
                    <td className="px-6 py-4">
                      <TypePill type={b.type} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {b.suggestedFor}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(b)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        aria-label={`Edit ${b.name}`}
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
        )}
      </Card>

      {/* Inline "New bundle" form — shown when "+ Create bundle" is clicked */}
      {showCreateForm && <NewBundleForm onCancel={handleCancelCreate} />}

      {/* Setup-flow nav row — Save & Draft + Save & Continue.
          Matches the Teams and Org Setup pages' footer pattern. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button variant="outline" size="lg" onClick={handleSaveDraft}>
          Save Draft
        </Button>
        <Button variant="primary" size="lg" onClick={handleSaveContinue}>
          <span className="flex items-center justify-center gap-2">
            Save &amp; Continue
            <ArrowRightIcon />
          </span>
        </Button>
      </div>
    </div>
  );
}

// ─── New Bundle Form ───────────────────────────────────────────────────

interface NewBundleFormProps {
  onCancel: () => void;
}

/**
 * Inline form for creating a new bundle. Matches the Figma design:
 * bundle name, type, products included, pricing method variants,
 * suggested event types, and internal notes. The page-level footer
 * (Save & Draft / Save & Continue) commits the form — this component
 * intentionally has no inline save buttons of its own.
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */
function NewBundleForm({ onCancel }: NewBundleFormProps) {
  const [bundleName, setBundleName] = useState("");
  const [bundleType, setBundleType] = useState("FLEXIBLE");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [pricingMethod, setPricingMethod] = useState<BundlePricingMethod>("TIERED");
  const [basePrice, setBasePrice] = useState("0.00");
  const [includedHours, setIncludedHours] = useState("4");
  const [perExtraHourRate, setPerExtraHourRate] = useState("0.00");
  const [maxHireHours, setMaxHireHours] = useState("12");
  const [overnightRate, setOvernightRate] = useState("");
  const [publicHolidayRate, setPublicHolidayRate] = useState("");
  // Hourly method fields
  const [ratePerHour, setRatePerHour] = useState("0.00");
  const [minimumHireHours, setMinimumHireHours] = useState("2");
  // Daily method fields
  const [fullDayRate, setFullDayRate] = useState("0.00");
  const [halfDayRate, setHalfDayRate] = useState("0.00");
  const [dailyOvernightRate, setDailyOvernightRate] = useState("0.00");
  // Custom tiers
  const [customTiers, setCustomTiers] = useState<CustomTier[]>([
    { id: "tier-1", tierType: "FIRST", hours: "3", price: "0.00" },
  ]);
  const [suggestedEventTypes, setSuggestedEventTypes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  /**
   * Append an empty row to the custom tier list.
   *
   * @author samir
   * @created 2026-04-11
   * @module Module A - Bundles & Packages
   */
  const addCustomTier = () => {
    setCustomTiers((prev) => [
      ...prev,
      {
        id: `tier-${Date.now()}`,
        tierType: "NEXT",
        hours: "",
        price: "0.00",
      },
    ]);
  };

  /**
   * Remove a custom tier row by id. Keeps at least one row so the
   * user always has a tier to edit.
   *
   * @author samir
   * @created 2026-04-11
   * @module Module A - Bundles & Packages
   */
  const removeCustomTier = (id: string) => {
    setCustomTiers((prev) =>
      prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)
    );
  };

  /**
   * Patch a single field on a custom tier row.
   *
   * @author samir
   * @created 2026-04-11
   * @module Module A - Bundles & Packages
   */
  const updateCustomTier = (
    id: string,
    patch: Partial<Omit<CustomTier, "id">>
  ) => {
    setCustomTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  /**
   * Toggle product selection in the multi-select list.
   *
   * @author samir
   * @created 2026-04-10
   * @module Module A - Bundles & Packages
   */
  const toggleProduct = (index: number) => {
    setSelectedProducts((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <Card padding="none">
      {/* Form header — "New bundle" left, Cancel right */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-slate-900">New bundle</h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
          aria-label="Cancel creating new bundle"
        >
          <CloseIcon />
          Cancel
        </button>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-6">
        {/* Row 1: Bundle name + Bundle type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Input
            label="Bundle name"
            required
            placeholder="e.g. Kids Party Starter"
            value={bundleName}
            onChange={(e) => setBundleName(e.target.value)}
          />
          <Select
            label="Bundle type"
            options={BUNDLE_TYPE_OPTIONS}
            value={bundleType}
            onChange={setBundleType}
            placeholder="Select type..."
          />
        </div>

        {/* Products included — multi-select list */}
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Products included <span className="text-red-500">*</span>
          </label>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 min-h-[140px] max-h-[220px] overflow-y-auto">
            {MOCK_PRODUCTS.map((product, idx) => {
              const isSelected = selectedProducts.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleProduct(idx)}
                  className={[
                    "flex items-center w-full px-2 py-2 rounded-lg text-sm text-left transition-colors",
                    isSelected
                      ? "bg-[#1a2f6e]/5 text-slate-900 font-medium"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${product.name}`}
                >
                  {product.name} &mdash;{" "}
                  {product.price ? `$${product.price}` : "TBC"}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-blue-600">
            Hold Ctrl/Cmd to select multiple
          </p>
        </div>

        {/* Bundle price section */}
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-slate-900">
            Bundle price
          </label>
          <div className="max-w-md">
            <Select
              options={PRICING_METHOD_OPTIONS}
              value={pricingMethod}
              onChange={(v) => setPricingMethod(v as BundlePricingMethod)}
              placeholder="Select pricing method..."
            />
          </div>
        </div>

        {/* Tiered pricing fields — shown when method is TIERED */}
        {pricingMethod === "TIERED" && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-5">
            {/* Base price + Included hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Base price
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-blue-600">
                  Price charged for the first X hours
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Included hours
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <input
                    type="text"
                    value={includedHours}
                    onChange={(e) => setIncludedHours(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="4"
                  />
                </div>
                <p className="text-xs text-slate-500 italic">
                  e.g. *first 3 hours is $999*
                </p>
              </div>
            </div>

            {/* Per extra hour rate + Maximum hire hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Per extra hour rate
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={perExtraHourRate}
                    onChange={(e) => setPerExtraHourRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Maximum hire hours
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <input
                    type="text"
                    value={maxHireHours}
                    onChange={(e) => setMaxHireHours(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="12"
                  />
                </div>
              </div>
            </div>

            {/* Overnight rate + Public holiday rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Overnight rate{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={overnightRate}
                    onChange={(e) => setOvernightRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="Leave blank if not offered"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Public holiday rate{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={publicHolidayRate}
                    onChange={(e) => setPublicHolidayRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="Leave blank to use global PH surcharge"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hourly pricing fields — shown when method is HOURLY */}
        {pricingMethod === "HOURLY" && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Rate per hour
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={ratePerHour}
                    onChange={(e) => setRatePerHour(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Minimum hire (Hours)
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <input
                    type="text"
                    value={minimumHireHours}
                    onChange={(e) => setMinimumHireHours(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily pricing fields — shown when method is DAILY */}
        {pricingMethod === "DAILY" && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Full day rate
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={fullDayRate}
                    onChange={(e) => setFullDayRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Half day rate{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={halfDayRate}
                    onChange={(e) => setHalfDayRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Overnight rate{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 h-12 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                  <span className="text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="text"
                    value={dailyOvernightRate}
                    onChange={(e) => setDailyOvernightRate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom tiers — shown when method is CUSTOM */}
        {pricingMethod === "CUSTOM" && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            {customTiers.map((tier) => (
              <CustomTierRow
                key={tier.id}
                tier={tier}
                onChange={(patch) => updateCustomTier(tier.id, patch)}
                onRemove={() => removeCustomTier(tier.id)}
                canRemove={customTiers.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addCustomTier}
              className="inline-flex items-center gap-2 rounded-full border border-[#1a2f6e]/30 bg-white px-5 py-2 text-sm font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
              aria-label="Add another pricing tier"
            >
              <PlusIcon />
              Add tier
            </button>
          </div>
        )}

        {/* Suggested for event types */}
        <Input
          label="Suggested for event types"
          placeholder="e.g. Kids birthday, School fete"
          value={suggestedEventTypes}
          onChange={(e) => setSuggestedEventTypes(e.target.value)}
        />

        {/* Internal notes — textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Internal notes
          </label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="e.g. Always check generator availability when this bundle is booked"
            rows={3}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-none"
          />
        </div>

      </div>
    </Card>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

/**
 * Blue info banner explaining locked vs flexible bundles.
 * Matches the Figma design with info icon and descriptive text.
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */
function InfoBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <span className="shrink-0 mt-0.5">
        <InfoIcon />
      </span>
      <p className="text-sm text-blue-800 leading-relaxed">
        <strong>Locked vs flexible bundles.</strong> A locked bundle cannot be
        changed on a quote &mdash; price and items are fixed. A flexible bundle
        is a starting point the sales team can customise. Set this per bundle.
      </p>
    </div>
  );
}

interface CustomTierRowProps {
  tier: CustomTier;
  onChange: (patch: Partial<Omit<CustomTier, "id">>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

/**
 * Single row in the Custom tiers list: tier type select, hours input,
 * "hrs at" separator, price input, and a remove button.
 *
 * @author samir
 * @created 2026-04-11
 * @module Module A - Bundles & Packages
 */
function CustomTierRow({ tier, onChange, onRemove, canRemove }: CustomTierRowProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:w-44">
        <Select
          options={CUSTOM_TIER_TYPE_OPTIONS}
          value={tier.tierType}
          onChange={(v) => onChange({ tierType: v })}
          placeholder="Tier type..."
        />
      </div>
      <div className="flex flex-1 items-center gap-3">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
          <input
            type="text"
            value={tier.hours}
            onChange={(e) => onChange({ hours: e.target.value })}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
            placeholder="3"
            aria-label="Tier hours"
          />
        </div>
        <span className="shrink-0 text-sm text-slate-500">hrs at</span>
        <div className="flex h-12 flex-[2] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 transition-colors focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
          <span className="text-sm text-slate-400 shrink-0">$</span>
          <input
            type="text"
            value={tier.price}
            onChange={(e) => onChange({ price: e.target.value })}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
            placeholder="0.00"
            aria-label="Tier price"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#1a2f6e]/30 text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Remove tier"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Green savings pill — shows the dollar amount saved.
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */
function SavingsPill({ savings }: { savings: number }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
      Save ${savings}
    </span>
  );
}

/**
 * Bundle type pill — "Flexible" (green tint) or "Locked" (grey).
 *
 * @author samir
 * @created 2026-04-10
 * @module Module A - Bundles & Packages
 */
function TypePill({ type }: { type: BundleType }) {
  const variantClass =
    type === "FLEXIBLE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${variantClass}`}
    >
      {type === "FLEXIBLE" ? "Flexible" : "Locked"}
    </span>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────

const BUNDLE_TYPE_OPTIONS = [
  { value: "FLEXIBLE", label: "Flexible \u2014 sales can modify" },
  { value: "LOCKED", label: "Locked \u2014 fixed price and items" },
];

// Author: samir
// Impact: expanded pricing method options from 2 to 4 (Hourly, Tiered,
//         Daily, Custom tiers) to match the bundle design spec
// Reason: sales team needs flexibility to price bundles per client's
//         model (flat hourly vs tiered vs daily vs bespoke breakpoints)
const PRICING_METHOD_OPTIONS = [
  { value: "HOURLY", label: "Hourly \u2014 flat rate per hour" },
  { value: "TIERED", label: "Tiered \u2014 base rate + per hour after threshold" },
  { value: "DAILY", label: "Daily \u2014 full day / half day" },
  { value: "CUSTOM", label: "Custom tiers \u2014 define each tier manually" },
];

const CUSTOM_TIER_TYPE_OPTIONS = [
  { value: "FIRST", label: "First X hours" },
  { value: "NEXT", label: "Next X hours" },
  { value: "AFTER", label: "After X hours" },
];

// ─── Icons ─────────────────────────────────────────────────────────────

/** Info circle icon for the banner. */
function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/** Pencil icon for Edit buttons. */
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

/** Close (X) icon for Cancel button. */
function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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
  );
}

/** Plus icon for the "Add tier" button. */
function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

/** Right arrow icon for the "Next" button. */
function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
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
  );
}
