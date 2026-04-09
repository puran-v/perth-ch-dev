"use client";

/**
 * WarehouseTab — fifth tab of the Product Details / Edit screen.
 *
 * Layout (top → bottom):
 *   1. Location in warehouse card — Voice AI info banner + Zone /
 *      Bay-shelf inputs + Location notes input. Used by Module C
 *      (Warehouse) to guide pickers via voice prompts.
 *   2. Post-job requirements card — title + "Add New Rules" button +
 *      list of toggleable post-job tasks. Four built-in toggles
 *      (cleaning, charging, consumable check, inspection) plus any
 *      custom rules the user has added. Each toggle creates the
 *      corresponding warehouse task on return in Module C.
 *   3. Substitutions card — locked amber warning explaining that
 *      substitution rules live in Module B and need to be configured
 *      there once Module B ships.
 *
 * The Add New Rules modal lets the admin define an org-specific
 * custom post-job rule. The new rule joins the toggle list immediately
 * and is persisted in the `customPostJobRules` text[] column on the
 * product. Removing a custom rule (un-toggling it) deletes it from
 * the array — there is no separate "off" state for custom rules.
 *
 * Backend status: WIRED. Every field is a controlled value owned by
 * the parent `ProductEditorForm`, which round-trips them through
 * `useCreateProduct` / `useUpdateProduct` to the products API.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Warehouse tab)
 */

// Old Author: Puran
// New Author: Puran
// Impact: refactored from local-state placeholder into a controlled
//         component owned by ProductEditorForm
// Reason: matches the OperationalTab refactor — now that the API is
//         live, the parent form needs to read every value at save
//         time so buildPayload() can include them in the mutation.

import { useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// ─── Props ─────────────────────────────────────────────────────────────

/**
 * Props for the controlled WarehouseTab. The parent owns every value
 * (location strings, four built-in booleans, and the custom rules
 * array) and supplies a setter for each. This component is purely
 * presentation + interaction — no save logic, no fetching.
 */
export interface WarehouseTabProps {
  warehouseZone: string;
  onChangeWarehouseZone: (v: string) => void;

  warehouseBayShelf: string;
  onChangeWarehouseBayShelf: (v: string) => void;

  warehouseLocationNotes: string;
  onChangeWarehouseLocationNotes: (v: string) => void;

  requiresCleaning: boolean;
  onChangeRequiresCleaning: (v: boolean) => void;

  requiresCharging: boolean;
  onChangeRequiresCharging: (v: boolean) => void;

  requiresConsumableCheck: boolean;
  onChangeRequiresConsumableCheck: (v: boolean) => void;

  requiresInspection: boolean;
  onChangeRequiresInspection: (v: boolean) => void;

  customPostJobRules: string[];
  onChangeCustomPostJobRules: (v: string[]) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Warehouse tab as a controlled component. Every
 * field is owned by ProductEditorForm — see WarehouseTabProps.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Warehouse tab)
 */
export function WarehouseTab(props: WarehouseTabProps) {
  const {
    warehouseZone,
    onChangeWarehouseZone,
    warehouseBayShelf,
    onChangeWarehouseBayShelf,
    warehouseLocationNotes,
    onChangeWarehouseLocationNotes,
    requiresCleaning,
    onChangeRequiresCleaning,
    requiresCharging,
    onChangeRequiresCharging,
    requiresConsumableCheck,
    onChangeRequiresConsumableCheck,
    requiresInspection,
    onChangeRequiresInspection,
    customPostJobRules,
    onChangeCustomPostJobRules,
  } = props;

  // ── Add New Rules modal state ───────────────────────────────────────
  // Modal state stays local — it's purely UI affordance, the parent
  // doesn't need to know whether the modal is open. The new rule is
  // pushed into customPostJobRules via onChange when the user clicks Add.
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");

  const handleOpenAddRule = () => {
    setRuleName("");
    setRuleDescription("");
    setAddRuleOpen(true);
  };

  const handleCloseAddRule = () => {
    setAddRuleOpen(false);
  };

  const handleAddRule = () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) {
      toast.error("Please enter a rule name.");
      return;
    }
    // Author: Puran
    // Impact: case-insensitive duplicate check before appending
    // Reason: stops "Check tank" and "check tank" from coexisting in
    //         the same product. The Description field is captured in
    //         the modal but intentionally NOT persisted — V1 stores
    //         titles only (Option A from the schema discussion).
    if (
      customPostJobRules.some(
        (r) => r.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      toast.info(`"${trimmedName}" is already in the list.`);
      return;
    }
    onChangeCustomPostJobRules([...customPostJobRules, trimmedName]);
    setAddRuleOpen(false);
    toast.success(`Rule "${trimmedName}" added.`);
  };

  const removeCustomRule = (rule: string) => {
    onChangeCustomPostJobRules(customPostJobRules.filter((r) => r !== rule));
  };

  return (
    <div className="space-y-4">
      {/* ── Location in warehouse card ───────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Location in warehouse
        </p>

        <div className="mt-3">
          <InfoBanner text="Voice AI in Module C uses this to guide warehouse staff. Map-based layout coming in Module C setup." />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Input
            label="Zone"
            value={warehouseZone}
            onChange={(e) => onChangeWarehouseZone(e.target.value)}
            placeholder="e.g. A, B, Zone 1"
          />
          <Input
            label="Bay / shelf"
            value={warehouseBayShelf}
            onChange={(e) => onChangeWarehouseBayShelf(e.target.value)}
            placeholder="e.g. Bay 3, Shelf B2"
          />
        </div>

        <div className="mt-4">
          <Input
            label="Location notes"
            value={warehouseLocationNotes}
            onChange={(e) => onChangeWarehouseLocationNotes(e.target.value)}
            placeholder="e.g. Left wall near roller door, stacked on blue pallet"
          />
        </div>
      </Card>

      {/* ── Post-job requirements card ───────────────────────────────── */}
      <Card padding="md">
        {/* Header — title left, Add New Rules button right. Stacks on
            small screens so the button doesn't push the title off
            320px-wide viewports. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">
            Post-job requirements
          </p>
          {/* Author: Puran */}
          {/* Impact: bumped from size="sm" (h-9) to size="md" (h-11) */}
          {/* Reason: Figma shows the button at the same h-11 height */}
          {/*         as the Create New Rule button on the Inventory */}
          {/*         tab. The smaller h-9 looked undersized next to */}
          {/*         the title text. */}
          <Button variant="primary" size="md" onClick={handleOpenAddRule}>
            Add New Rules
          </Button>
        </div>

        {/* Toggle list — same shape as the Discounting card on the
            Pricing tab. Built-in rules first, custom rules below. */}
        <div className="mt-3 flex flex-col divide-y divide-slate-100">
          <ToggleRow
            title="Requires cleaning after return"
            description="Creates a cleaning task when this product returns from a job."
            checked={requiresCleaning}
            onChange={() => onChangeRequiresCleaning(!requiresCleaning)}
          />
          <ToggleRow
            title="Requires charging after return"
            description="For battery-powered items — creates a charging task on return."
            checked={requiresCharging}
            onChange={() => onChangeRequiresCharging(!requiresCharging)}
          />
          <ToggleRow
            title="Requires consumable top-up check"
            description="For items using consumables (sugar, CO2 etc.) — prompts a check on return."
            checked={requiresConsumableCheck}
            onChange={() =>
              onChangeRequiresConsumableCheck(!requiresConsumableCheck)
            }
          />
          <ToggleRow
            title="Requires inspection before next hire"
            description="Prompts a condition check before the item can be marked available again."
            checked={requiresInspection}
            onChange={() => onChangeRequiresInspection(!requiresInspection)}
          />

          {/* Custom rules — always considered "on" since their presence
              in the array IS their on-state. Toggling off removes the
              rule entirely. The label "Custom" disambiguates them from
              the four presets above. */}
          {customPostJobRules.map((rule) => (
            <ToggleRow
              key={rule}
              title={rule}
              description="Custom post-job rule. Toggle off to remove."
              checked={true}
              onChange={() => removeCustomRule(rule)}
            />
          ))}
        </div>
      </Card>

      {/* ── Substitutions card ───────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Substitutions</p>

        <div className="mt-3">
          <LockedBanner text="Substitution rules are configured in Module B — Inventory. Complete your product setup first, then configure substitutions once Module B is built." />
        </div>
      </Card>

      {/* ── Add New Rules modal ──────────────────────────────────────── */}
      <Modal
        open={addRuleOpen}
        onClose={handleCloseAddRule}
        title="Add New Rules"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Rule Name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Check water tank level"
            autoFocus
          />
          {/* Description is captured for UX (helps the user think it
              through) but intentionally NOT persisted in V1. The DB
              column stores titles only — see the schema comment on
              `customPostJobRules` in prisma/schema.prisma. */}
          <Input
            label="Rule Description (not saved)"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder="Optional — for your own reference"
          />
          <Button variant="primary" size="lg" fullWidth onClick={handleAddRule}>
            <span className="flex items-center justify-center gap-2">
              <PlusIcon />
              Add
            </span>
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface InfoBannerProps {
  text: string;
}

/**
 * Info banner — uses the brand `blue` token (#0062FF from
 * PROJECT_RULES.md §10.1) for the icon + body text. Same shape used
 * by the Inventory and Notes & Rules tabs so the form palette stays
 * uniform across product tabs.
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
        <p className="text-xs sm:text-sm text-blue leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

interface LockedBannerProps {
  text: string;
}

/**
 * Locked banner shown on the Substitutions card. Indicates a feature
 * gated on a future module shipping. Uses the brand `mango` token
 * (#FF9F29 from PROJECT_RULES.md §10.1) so it reads as "warning, not
 * error" — the user isn't being blocked from doing anything they
 * could otherwise do.
 */
function LockedBanner({ text }: LockedBannerProps) {
  return (
    <div className="rounded-2xl border border-mango bg-mango/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-mango"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <p className="text-xs sm:text-sm text-mango leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

/**
 * Title + description + switch row — same shape used inside the
 * Pricing tab's Discounting card and the Basic Info tab's Configurable
 * product card. Inlined here for V1; if we get a 4th use I'll extract
 * to a shared `<ToggleRow>` primitive.
 */
function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
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
    </div>
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
