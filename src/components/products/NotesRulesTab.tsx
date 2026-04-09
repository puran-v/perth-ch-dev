"use client";

/**
 * NotesRulesTab — sixth and final tab of the Product Details / Edit
 * screen.
 *
 * Layout (top → bottom):
 *   1. Top info banner explaining how the AI consumes the notes
 *      below (uses the brand `blue` token #0062FF).
 *   2. Sales team notes card — title + audience subtitle + textarea.
 *      Visible to sales when building a quote.
 *   3. Warehouse team notes card — title + audience subtitle + textarea.
 *      Visible to warehouse on pick lists and loading sheets.
 *   4. AI product rules card — title + audience subtitle + textarea +
 *      footer disclaimer that these override or supplement global rules.
 *
 * Backend status: same as the other product tabs — entirely client
 * state for V1. Each card is just a labelled textarea; when the API
 * lands the parent ProductEditorForm lifts these via props + onChange.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
 */

// Author: Puran
// Impact: new dedicated component for the Notes & Rules tab — this
//         is the sixth and final tab on the product editor
// Reason: completes the Module A product editor's tab set so every
//         click in the tab bar lands on real content instead of the
//         ComingSoonTab placeholder

import { useState } from "react";
import { Card } from "@/components/ui/Card";

// ─── Mock seeds ────────────────────────────────────────────────────────

const INITIAL_SALES_NOTES = `- Always confirm surface type — cannot be set up on loose gravel or sand
- Minimum space required: 6m × 6m clear area plus 1m clearance on all sides
- Pair with Snow Cone Machine for kids events — strong upsell combination
- If client is unsure on size, Big Blue Castle is the safer recommendation
- Check access route width if delivery address is in a tight residential street`;

const INITIAL_WAREHOUSE_NOTES = `- Store deflated and rolled — blower stored on top of the castle roll
- Check all seams before every hire — pay attention to the entrance arch
- Peg bag and repair kit must always go in the cab bag`;

const INITIAL_AI_RULES = `- Always requires 2 staff to set up and pack down
- Do not book for outdoor events in direct sun when temperature exceeds 35°C
- If booked for more than 6 hours, schedule a blower check at the midpoint`;

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Notes & Rules tab. State is owned locally for V1;
 * lift to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
 */
export function NotesRulesTab() {
  const [salesNotes, setSalesNotes] = useState(INITIAL_SALES_NOTES);
  const [warehouseNotes, setWarehouseNotes] = useState(INITIAL_WAREHOUSE_NOTES);
  const [aiRules, setAiRules] = useState(INITIAL_AI_RULES);

  return (
    <div className="space-y-4">
      {/* ── Top info banner ──────────────────────────────────────────── */}
      <InfoBanner text="Write notes the way you'd brief a new team member. The AI reads product rules when reviewing quotes, checking completeness, and making suggestions." />

      {/* ── Sales team notes card ────────────────────────────────────── */}
      <NotesCard
        title="Sales team notes"
        audience="Visible to sales when building a quote"
        value={salesNotes}
        onChange={setSalesNotes}
        rows={6}
      />

      {/* ── Warehouse team notes card ────────────────────────────────── */}
      <NotesCard
        title="Warehouse team notes"
        audience="Visible to warehouse on pick lists and loading sheets"
        value={warehouseNotes}
        onChange={setWarehouseNotes}
        rows={5}
      />

      {/* ── AI product rules card ────────────────────────────────────── */}
      <NotesCard
        title="AI product rules"
        audience="Rules the AI applies specifically for this product"
        value={aiRules}
        onChange={setAiRules}
        rows={5}
        footnote="These override or supplement global rules for this product specifically."
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface InfoBannerProps {
  text: string;
}

/**
 * Info banner — same shape as the Inventory + Warehouse tab info
 * banners. Uses the brand `blue` token (#0062FF) for the icon + body
 * text and Tailwind blue-50/300 for the lighter shell.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
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

interface NotesCardProps {
  title: string;
  audience: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  footnote?: string;
}

/**
 * Reusable notes card — title, audience subtitle, full-width
 * textarea, and optional footnote below the textarea.
 *
 * The textarea uses the same border-radius / focus-ring treatment
 * as the description textarea on the Basic Info tab so the form
 * family stays uniform.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
 */
function NotesCard({
  title,
  audience,
  value,
  onChange,
  rows = 5,
  footnote,
}: NotesCardProps) {
  return (
    <Card padding="md">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs sm:text-sm text-slate-500">{audience}</p>

      <div className="mt-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          aria-label={title}
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-y min-h-25 leading-relaxed"
        />
      </div>

      {footnote && (
        <p className="mt-3 text-xs text-slate-500">{footnote}</p>
      )}
    </Card>
  );
}
