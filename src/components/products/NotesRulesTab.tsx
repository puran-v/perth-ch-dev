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
 * Backend status: WIRED. Every textarea is a controlled value owned by
 * the parent `ProductEditorForm`, which round-trips them through
 * `useCreateProduct` / `useUpdateProduct` to the products API. Empty
 * input collapses to null in the payload so the DB stores a real
 * "no notes" state instead of an empty string.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
 */

// Old Author: Puran
// New Author: Puran
// Impact: refactored from local-state placeholder (with seeded mock
//         strings) into a controlled component owned by ProductEditorForm
// Reason: matches the OperationalTab and WarehouseTab refactors —
//         parent owns every value so buildPayload() can roll them
//         into the same create/update mutation as the other tabs.
//         Mock seed strings (INITIAL_SALES_NOTES etc.) are gone since
//         real data flows in from the API now.

import { Card } from "@/components/ui/Card";

// ─── Props ─────────────────────────────────────────────────────────────

/**
 * Props for the controlled NotesRulesTab. Three free-form text fields
 * — one per audience — owned by ProductEditorForm.
 */
export interface NotesRulesTabProps {
  salesNotes: string;
  onChangeSalesNotes: (v: string) => void;

  warehouseNotes: string;
  onChangeWarehouseNotes: (v: string) => void;

  aiRules: string;
  onChangeAiRules: (v: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Notes & Rules tab as a controlled component. Every
 * textarea's value comes from the parent form via props.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Notes & Rules tab)
 */
export function NotesRulesTab(props: NotesRulesTabProps) {
  const {
    salesNotes,
    onChangeSalesNotes,
    warehouseNotes,
    onChangeWarehouseNotes,
    aiRules,
    onChangeAiRules,
  } = props;

  return (
    <div className="space-y-4">
      {/* ── Top info banner ──────────────────────────────────────────── */}
      <InfoBanner text="Write notes the way you'd brief a new team member. The AI reads product rules when reviewing quotes, checking completeness, and making suggestions." />

      {/* ── Sales team notes card ────────────────────────────────────── */}
      <NotesCard
        title="Sales team notes"
        audience="Visible to sales when building a quote"
        value={salesNotes}
        onChange={onChangeSalesNotes}
        rows={6}
        placeholder="e.g. Always confirm surface type — cannot be set up on loose gravel or sand"
      />

      {/* ── Warehouse team notes card ────────────────────────────────── */}
      <NotesCard
        title="Warehouse team notes"
        audience="Visible to warehouse on pick lists and loading sheets"
        value={warehouseNotes}
        onChange={onChangeWarehouseNotes}
        rows={5}
        placeholder="e.g. Store deflated and rolled — blower stored on top of the castle roll"
      />

      {/* ── AI product rules card ────────────────────────────────────── */}
      <NotesCard
        title="AI product rules"
        audience="Rules the AI applies specifically for this product"
        value={aiRules}
        onChange={onChangeAiRules}
        rows={5}
        placeholder="e.g. Do not book for outdoor events when temperature exceeds 35°C"
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

interface NotesCardProps {
  title: string;
  audience: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  footnote?: string;
  placeholder?: string;
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
  placeholder,
}: NotesCardProps) {
  // Old Author: Puran
  // New Author: Puran
  // Impact: bumped card title + audience + textarea text from
  //         text-sm/text-xs → text-base, and the textarea bg from
  //         white to slate-50 for the inset look
  // Reason: Figma shows the notes cards with larger body-base text
  //         and an inset textarea (slate-50 fill, lighter border)
  //         instead of the white textarea I had. Title stays
  //         semibold-medium for the section header treatment;
  //         audience subtitle gains slate-700 with `font-medium`
  //         so it reads as a sub-header rather than caption text.
  return (
    <Card padding="md">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-base font-medium text-slate-700">{audience}</p>

      <div className="mt-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          aria-label={title}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 resize-y min-h-32 leading-relaxed"
        />
      </div>

      {footnote && (
        <p className="mt-3 text-sm text-slate-500">{footnote}</p>
      )}
    </Card>
  );
}
