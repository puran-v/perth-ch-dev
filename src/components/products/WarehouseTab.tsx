"use client";

/**
 * WarehouseTab — fifth tab of the Product Details / Edit screen.
 *
 * Layout (top → bottom):
 *   1. Location in warehouse card — Voice AI info banner + Zone /
 *      Bay-shelf inputs + Location notes input. Used by Module C
 *      (Warehouse) to guide pickers via voice prompts.
 *   2. Post-job requirements card — title + "Add New Rules" button +
 *      list of toggleable post-job tasks (cleaning, charging,
 *      consumable check, inspection). Each toggle creates the
 *      corresponding task on return in Module C.
 *   3. Substitutions card — locked amber warning explaining that
 *      substitution rules live in Module B and need to be configured
 *      there once Module B ships.
 *
 * Plus a small Add New Rules modal launched from the Post-job
 * requirements header. The modal lets the admin define an org-specific
 * custom post-job task with a name and description.
 *
 * Backend status: same as the other product tabs — entirely client
 * state for V1. The Add New Rules modal stubs to a toast (and would
 * eventually append to a `customRules` array on the product).
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Warehouse tab)
 */

// Author: Puran
// Impact: new dedicated component for the Warehouse tab + Add New
//         Rules modal
// Reason: same per-tab pattern as PricingTab / InventoryTab /
//         OperationalTab — keep ProductEditorForm thin

import { useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// ─── Types ─────────────────────────────────────────────────────────────

interface PostJobToggle {
  id: string;
  title: string;
  description: string;
  checked: boolean;
}

const INITIAL_POST_JOB_TOGGLES: PostJobToggle[] = [
  {
    id: "cleaning",
    title: "Requires cleaning after return",
    description:
      "Creates a cleaning task when this product returns from a job.",
    checked: true,
  },
  {
    id: "charging",
    title: "Requires charging after return",
    description:
      "For battery-powered items — creates a charging task on return.",
    checked: false,
  },
  {
    id: "consumable",
    title: "Requires consumable top-up check",
    description:
      "For items using consumables (sugar, CO2 etc.) — prompts a check on return.",
    checked: false,
  },
  {
    id: "inspection",
    title: "Requires inspection before next hire",
    description:
      "Prompts a condition check before the item can be marked available again.",
    checked: true,
  },
];

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Warehouse tab. State is owned locally for V1; lift
 * to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Warehouse tab)
 */
export function WarehouseTab() {
  // ── Location state ──────────────────────────────────────────────────
  const [zone, setZone] = useState("");
  const [bayShelf, setBayShelf] = useState("");
  const [locationNotes, setLocationNotes] = useState("");

  // ── Post-job toggles ────────────────────────────────────────────────
  const [postJobToggles, setPostJobToggles] = useState<PostJobToggle[]>(
    INITIAL_POST_JOB_TOGGLES,
  );

  const toggleRule = (id: string) => {
    setPostJobToggles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t)),
    );
  };

  // ── Add New Rules modal state ───────────────────────────────────────
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
    // Impact: append the custom rule as a new toggle on the post-job list
    // Reason: matches the Figma flow — the user creates a rule and it
    //         immediately shows up in the toggle list as a new row,
    //         pre-checked so they know it was added. When the API lands
    //         this becomes a useApiMutation that round-trips through
    //         /api/orgs/current/products/:id/post-job-rules.
    setPostJobToggles((prev) => [
      ...prev,
      {
        id: `custom-${Date.now().toString(36)}`,
        title: trimmedName,
        description: ruleDescription.trim() || "Custom post-job rule.",
        checked: true,
      },
    ]);
    setAddRuleOpen(false);
    toast.success(`Rule "${trimmedName}" added.`);
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
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="e.g. A, B, Zone 1"
          />
          <Input
            label="Bay / shelf"
            value={bayShelf}
            onChange={(e) => setBayShelf(e.target.value)}
            placeholder="e.g. A, B, Zone 1 Bay / shelf"
          />
        </div>

        <div className="mt-4">
          <Input
            label="Location notes"
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
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
          <Button variant="primary" size="sm" onClick={handleOpenAddRule}>
            Add New Rules
          </Button>
        </div>

        {/* Toggle list — same shape as the Discounting card on the
            Pricing tab. Uses the inline switch pattern shared across
            the form. */}
        <div className="mt-3 flex flex-col divide-y divide-slate-100">
          {postJobToggles.map((rule) => (
            <ToggleRow
              key={rule.id}
              title={rule.title}
              description={rule.description}
              checked={rule.checked}
              onChange={() => toggleRule(rule.id)}
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
            placeholder="Enter"
            autoFocus
          />
          <Input
            label="Rule Description"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder="Enter"
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
 *
 * Author: Puran
 * Impact: switched icon + text from text-blue-700 → text-blue (brand)
 * Reason: client confirmed #0062FF is the highlight blue across the
 *         design — it's our brand `blue` token, not Tailwind's
 *         default blue-700. Always use the token.
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
        <p className="text-xs sm:text-sm text-blue leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

interface LockedBannerProps {
  text: string;
}

/**
 * Locked banner shown on the Substitutions card. Indicates a feature
 * that's gated on a future module shipping. Uses the brand `mango`
 * token (#FF9F29 from PROJECT_RULES.md §10.1) so it reads as
 * "warning, not error" — the user isn't being blocked from doing
 * anything they could otherwise do.
 *
 * Author: Puran
 * Impact: switched from amber-* Tailwind palette to the brand mango
 *         token to match the Figma exactly
 * Reason: mango is in the design system (§10.1) and the Figma colour
 *         picker confirmed #FF9F29. Using `bg-mango/10` for the tint
 *         + solid `border-mango` and `text-mango` keeps the banner
 *         on the design tokens instead of an arbitrary amber.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Warehouse tab)
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
        <p className="text-xs sm:text-sm text-mango leading-relaxed">
          {text}
        </p>
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
