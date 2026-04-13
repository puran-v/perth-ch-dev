"use client";

/**
 * OperationalTab — fourth tab of the Product Details / Edit screen.
 *
 * Layout (top → bottom):
 *   1. Setup & packdown card — default setup/packdown minutes + staff
 *      requirements for setup and operate/supervise.
 *   2. Dimensions & weight card — physical dimensions (length / width
 *      / height in metres), weight (kg), and truck space units used
 *      by the warehouse capacity planner.
 *   3. Handling flags card — toggleable preset chips. Fixed list, no
 *      custom add-flag affordance (the Figma calls for presets only).
 *
 * Backend status: WIRED. Every field is a controlled value owned by
 * the parent `ProductEditorForm`, which round-trips them through
 * `useCreateProduct` / `useUpdateProduct` to the products API.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */

// Old Author: Puran
// New Author: Puran
// Impact: refactored from local-state placeholder into a fully
//         controlled component owned by ProductEditorForm
// Reason: the API is live now — keeping state local meant Save
//         Changes never saw any of these values. Lifting state to
//         the parent puts every operational field in `buildPayload()`
//         alongside the Basic Info fields.

import { useState } from "react";
import { toast } from "react-toastify";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

// ─── Built-in handling flags ───────────────────────────────────────────

/**
 * Built-in handling flags shown in the Handling flags grid. Order is
 * the order they render in the grid (left → right, top → bottom).
 * The list is intentionally fixed — no custom flag affordance — and
 * the column type stays text[] so re-introducing custom flags later
 * is purely a UI change.
 *
 * Adding / renaming / removing a preset is a one-line edit here — no
 * migration, no DB change.
 */
const BUILTIN_FLAGS = [
  "Requires Power",
  "Fragile",
  "Outdoor only",
  "Wet/Dry use",
  "Heavy left (2+staff)",
  "Tail lift required",
  "Water supply needed",
  "Senior leader required",
  "Overnight capable",
] as const;

// ─── Props ─────────────────────────────────────────────────────────────

/**
 * Every value here is owned by `ProductEditorForm` so the form's
 * `buildPayload()` can roll it into the create/update mutation.
 *
 * Numeric fields use `string` for the editor's display value rather
 * than `number` so the user can type and clear the field freely; the
 * parent converts to `number | null` at save time. Dimensions are
 * nullable in the DB so an empty input → `null`, not `0`.
 */
export interface OperationalTabProps {
  setupMinutes: string;
  onChangeSetupMinutes: (v: string) => void;

  packdownMinutes: string;
  onChangePackdownMinutes: (v: string) => void;

  staffSetup: string;
  onChangeStaffSetup: (v: string) => void;

  staffOperate: string;
  onChangeStaffOperate: (v: string) => void;

  lengthM: string;
  onChangeLengthM: (v: string) => void;

  widthM: string;
  onChangeWidthM: (v: string) => void;

  heightM: string;
  onChangeHeightM: (v: string) => void;

  weightKg: string;
  onChangeWeightKg: (v: string) => void;

  truckSpaceUnits: string;
  onChangeTruckSpaceUnits: (v: string) => void;

  handlingFlags: string[];
  onChangeHandlingFlags: (v: string[]) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Operational tab as a controlled component. The
 * parent form owns all field values and supplies setters; this
 * component is purely presentation + interaction.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */
export function OperationalTab(props: OperationalTabProps) {
  const {
    setupMinutes,
    onChangeSetupMinutes,
    packdownMinutes,
    onChangePackdownMinutes,
    staffSetup,
    onChangeStaffSetup,
    staffOperate,
    onChangeStaffOperate,
    lengthM,
    onChangeLengthM,
    widthM,
    onChangeWidthM,
    heightM,
    onChangeHeightM,
    weightKg,
    onChangeWeightKg,
    truckSpaceUnits,
    onChangeTruckSpaceUnits,
    handlingFlags,
    onChangeHandlingFlags,
  } = props;

  // Author: Puran
  // Impact: preset toggle + custom flag input so each company can
  //         create their own handling flags beyond the 9 built-in ones
  // Reason: client requirement — orgs have unique handling needs that
  //         the fixed preset list can't cover. The storage is already
  //         text[] so custom strings flow through without any backend
  //         change. Custom flags show as removable chips below presets.
  const flagSet = new Set(handlingFlags);
  const builtinSet = new Set<string>(BUILTIN_FLAGS);
  const customFlags = handlingFlags.filter((f) => !builtinSet.has(f));

  const [customDraft, setCustomDraft] = useState("");

  const togglePreset = (flag: string) => {
    if (flagSet.has(flag)) {
      onChangeHandlingFlags(handlingFlags.filter((f) => f !== flag));
    } else {
      onChangeHandlingFlags([...handlingFlags, flag]);
    }
  };

  const addCustomFlag = () => {
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    if (trimmed.length > 80) {
      toast.error("Flag name must be 80 characters or less.");
      return;
    }
    if (flagSet.has(trimmed)) {
      toast.info("This flag already exists.");
      return;
    }
    onChangeHandlingFlags([...handlingFlags, trimmed]);
    setCustomDraft("");
  };

  const removeCustomFlag = (flag: string) => {
    onChangeHandlingFlags(handlingFlags.filter((f) => f !== flag));
  };

  // Author: Puran
  // Impact: numeric input dispatcher that strips non-digits + decimal
  // Reason: every numeric field on this tab needs the same "keep it
  //         clean" sanitisation. A single helper avoids 9 copies of
  //         the same regex.
  const numericChange =
    (setter: (v: string) => void, allowDecimal = false) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = allowDecimal
        ? e.target.value.replace(/[^0-9.]/g, "")
        : e.target.value.replace(/[^0-9]/g, "");
      setter(cleaned);
    };

  return (
    <div className="space-y-4">
      {/* ── Setup & packdown card ────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Setup &amp; packdown</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <Input
              label="Default setup time (minutes)"
              value={setupMinutes}
              onChange={numericChange(onChangeSetupMinutes)}
              placeholder="0"
              inputMode="numeric"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Used by scheduling AI unless overridden on a booking
            </p>
          </div>
          <div>
            <Input
              label="Default packdown time (minutes)"
              value={packdownMinutes}
              onChange={numericChange(onChangePackdownMinutes)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div>
            <Input
              label="Staff required — setup"
              value={staffSetup}
              onChange={numericChange(onChangeStaffSetup)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div>
            <Input
              label="Staff required — operate / supervise"
              value={staffOperate}
              onChange={numericChange(onChangeStaffOperate)}
              placeholder="0"
              inputMode="numeric"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Staff needed to run the product during the event
            </p>
          </div>
        </div>
      </Card>

      {/* ── Dimensions & weight card ─────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">
          Dimensions &amp; weight
        </p>

        {/* Length / Width / Height — 3-col on md+ */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <Input
            label="Length (m)"
            value={lengthM}
            onChange={numericChange(onChangeLengthM, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <Input
            label="Width (m)"
            value={widthM}
            onChange={numericChange(onChangeWidthM, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <Input
            label="Height (m)"
            value={heightM}
            onChange={numericChange(onChangeHeightM, true)}
            placeholder="0"
            inputMode="decimal"
          />
        </div>

        {/* Weight + Truck space — 2-col on md+ */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Input
            label="Weight (kg)"
            value={weightKg}
            onChange={numericChange(onChangeWeightKg, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <div>
            <Input
              label="Truck space (units)"
              value={truckSpaceUnits}
              onChange={numericChange(onChangeTruckSpaceUnits)}
              placeholder="0"
              inputMode="numeric"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Used for truck capacity planning
            </p>
          </div>
        </div>
      </Card>

      {/* ── Handling flags card ──────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Handling flags</p>
          <button
            type="button"
            onClick={() => {
              if (!customDraft.trim()) {
                setCustomDraft("");
                const input = document.getElementById("custom-flag-input");
                input?.focus();
                return;
              }
              addCustomFlag();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#042E93] px-5 h-10 text-xs font-semibold text-white transition-colors hover:bg-[#042E93]/90 cursor-pointer"
          >
            Add New Custom Notes
          </button>
        </div>

        {/* Built-in preset grid — 1 col mobile, 2 sm, 3 md+ */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {BUILTIN_FLAGS.map((flag) => (
            <FlagChip
              key={flag}
              label={flag}
              selected={flagSet.has(flag)}
              onToggle={() => togglePreset(flag)}
            />
          ))}
        </div>

        {/* Custom flags — org-specific flags added by the user */}
        {customFlags.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Custom flags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {customFlags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue bg-blue-50 px-3 h-8 text-xs font-medium text-blue"
                >
                  {flag}
                  <button
                    type="button"
                    onClick={() => removeCustomFlag(flag)}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue/10 cursor-pointer"
                    aria-label={`Remove flag ${flag}`}
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
            </div>
          </div>
        )}

        {/* Inline custom flag input — always visible so user can type + Enter */}
        <div className="mt-4 max-w-sm">
          <Input
            id="custom-flag-input"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomFlag();
              }
            }}
            placeholder="Type a custom flag and press Enter"
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface FlagChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * Toggleable preset flag chip. Uses the brand `blue` token (#0062FF)
 * for the selected state — same family as the InfoBanner / AI bubble /
 * pricing preview cells across the rest of the form.
 *
 * Selected state: brand-blue solid border + light blue bg + brand-blue text.
 * Unselected: slate outline + white bg + slate text.
 *
 * Uses role="switch" so screen readers know it's a toggle, not a
 * navigation button.
 *
 * Old Author: Puran
 * New Author: Puran
 * Impact: switched selected state from dark navy (#1a2f6e) tint to
 *         the brand `blue` token solid border + bg-blue-50 fill +
 *         text-blue
 * Reason: Figma shows the selected chips on the same brand `#0062FF`
 *         family as the rest of the form's info-highlight surfaces.
 *         The old dark-navy treatment didn't match the screenshot.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */
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

function FlagChip({ label, selected, onToggle }: FlagChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      onClick={onToggle}
      className={[
        "h-11 w-full rounded-full border px-4 text-sm font-medium transition-colors cursor-pointer",
        selected
          ? "border-blue bg-blue-50 text-blue"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
