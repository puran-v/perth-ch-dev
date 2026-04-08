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
 *   3. Handling flags card — 3×3 grid of toggleable flag chips with a
 *      "+ Add New Custom Notes" primary button in the header for
 *      defining org-specific flags beyond the built-in set.
 *
 * Backend status: same as the other product tabs — entirely client
 * state for V1. When the API lands the parent ProductEditorForm
 * lifts state via props + onChange.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */

// Author: Puran
// Impact: new dedicated component for the Operational tab
// Reason: each tab gets its own file so ProductEditorForm doesn't
//         balloon as more tabs land. Same pattern as PricingTab and
//         InventoryTab.

import { useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

// ─── Types ─────────────────────────────────────────────────────────────

/**
 * Built-in handling flags shown in the Handling flags grid. The
 * order is the order they render in the grid (left → right, top →
 * bottom). Custom flags added via "Add New Custom Notes" go at the
 * end of the array.
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

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Operational tab. State is owned locally for V1;
 * lift to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */
export function OperationalTab() {
  // ── Setup & packdown state ──────────────────────────────────────────
  const [setupMinutes, setSetupMinutes] = useState("45");
  const [packdownMinutes, setPackdownMinutes] = useState("30");
  const [staffSetup, setStaffSetup] = useState("2");
  const [staffOperate, setStaffOperate] = useState("1");

  // ── Dimensions & weight state ───────────────────────────────────────
  const [length, setLength] = useState("6");
  const [width, setWidth] = useState("5");
  const [height, setHeight] = useState("4");
  const [weight, setWeight] = useState("85");
  const [truckSpace, setTruckSpace] = useState("1");

  // ── Handling flags state ────────────────────────────────────────────
  // Stored as a Set so toggling is O(1) and the same flag can never
  // accidentally be selected twice. Seeded with the two flags shown
  // pre-selected in the Figma so the screen looks right on first load.
  const [flags, setFlags] = useState<Set<string>>(
    () => new Set(["Requires Power", "Tail lift required"])
  );

  const toggleFlag = (flag: string) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
  };

  // Author: Puran
  // Impact: numeric input dispatcher that strips non-digits + decimal
  // Reason: every numeric field on this tab (minutes, count, length,
  //         weight, etc.) needs the same "keep it clean" sanitisation.
  //         A single helper avoids 9 copies of the same regex.
  const numericChange =
    (setter: (v: string) => void, allowDecimal = false) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = allowDecimal
        ? e.target.value.replace(/[^0-9.]/g, "")
        : e.target.value.replace(/[^0-9]/g, "");
      setter(cleaned);
    };

  const handleAddCustomNote = () => {
    toast.info("Custom flag editor — coming soon.");
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
              onChange={numericChange(setSetupMinutes)}
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
              onChange={numericChange(setPackdownMinutes)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div>
            <Input
              label="Staff required — setup"
              value={staffSetup}
              onChange={numericChange(setStaffSetup)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div>
            <Input
              label="Staff required — operate / supervise"
              value={staffOperate}
              onChange={numericChange(setStaffOperate)}
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
            value={length}
            onChange={numericChange(setLength, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <Input
            label="Width (m)"
            value={width}
            onChange={numericChange(setWidth, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <Input
            label="Height (m)"
            value={height}
            onChange={numericChange(setHeight, true)}
            placeholder="0"
            inputMode="decimal"
          />
        </div>

        {/* Weight + Truck space — 2-col on md+ */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Input
            label="Weight (kg)"
            value={weight}
            onChange={numericChange(setWeight, true)}
            placeholder="0"
            inputMode="decimal"
          />
          <div>
            <Input
              label="Truck space (units)"
              value={truckSpace}
              onChange={numericChange(setTruckSpace, true)}
              placeholder="0"
              inputMode="decimal"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Used for truck capacity planning
            </p>
          </div>
        </div>
      </Card>

      {/* ── Handling flags card ──────────────────────────────────────── */}
      <Card padding="md">
        {/* Header row — title left, Add New Custom Notes button right.
            Stacks on small screens so the button doesn't push the title
            off the edge on 320px. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Handling flags</p>
          <Button variant="primary" size="sm" onClick={handleAddCustomNote}>
            Add New Custom Notes
          </Button>
        </div>

        {/* 3×3 grid of toggleable flag chips. 1 col on mobile, 2 cols on
            sm, 3 cols on md+ so the grid feels balanced at every width. */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {BUILTIN_FLAGS.map((flag) => (
            <FlagChip
              key={flag}
              label={flag}
              selected={flags.has(flag)}
              onToggle={() => toggleFlag(flag)}
            />
          ))}
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
 * Toggleable flag chip — large pill button used in the Handling
 * flags grid. Same colour family as the other "primary highlight"
 * chips on the form (PricingTab Try-an-example, ProductEditorForm
 * Configuration summary) so the visual language stays uniform.
 *
 * Selected state: blue outline + light blue bg + blue text.
 * Unselected: slate outline + white bg + slate text.
 *
 * Uses role="switch" so screen readers know it's a toggle, not a
 * navigation button.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Operational tab)
 */
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
          ? "border-[#1a2f6e]/50 bg-[#1a2f6e]/5 text-[#1a2f6e]"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
