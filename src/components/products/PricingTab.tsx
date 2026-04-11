"use client";

/**
 * PricingTab — second tab of the Product Details / Edit screen.
 *
 * Layout (top → bottom):
 *   1. AI chat card — natural-language pricing description with a
 *      mock conversation flow. Real AI integration is out of scope
 *      for V1; the Send button appends the user message and a canned
 *      AI reply so the interaction feels real.
 *   2. "Try an example" chip row — preset prompts. Clicking a chip
 *      populates the chat input and (in V1) does NOT auto-send.
 *   3. Structured pricing card — editable tiers (Duration/Condition,
 *      Rate, Unit) with add and remove. The AI parse will eventually
 *      populate this from the chat above; for V1 it's seeded with the
 *      same demo tiers shown in the chat reply.
 *   4. Price preview row — read-only cards showing how the sales team
 *      sees the pricing at common durations. Hardcoded mock for V1;
 *      will derive from `tiers` once the calc engine lands.
 *   5. Public holiday rate + Minimum hire duration — two-column row.
 *   6. Discounting card — two toggles (allow discounts, include in
 *      bundle pricing) using the same switch pattern as the
 *      Configurable product toggle on the Basic Info tab.
 *
 * Backend status: this tab is entirely client-state for V1. When the
 * product API lands, the parent form (`ProductEditorForm`) will lift
 * the pricing state via props + onChange callback so Save Changes
 * round-trips through useApiMutation. For now, every interactive
 * element is local state and Save Changes still toasts success.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Pricing tab)
 */

// Author: Puran
// Impact: new dedicated component for the Pricing tab — extracted out
//         of ProductEditorForm so the main form doesn't balloon past
//         1000 lines as more tabs land
// Reason: the Pricing tab Figma is rich (chat + tiers + preview +
//         discounts) and warrants its own file for readability. Same
//         pattern Bundles, Quote Templates, etc. will follow.

import { useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

// ─── Types ─────────────────────────────────────────────────────────────

type ChatRole = "user" | "ai";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface PricingTier {
  id: string;
  /** Free-text duration / condition label e.g. "First 3 hours" */
  duration: string;
  /** Whole-dollar rate as a string so the input can hold partial values */
  rate: string;
  /** Unit label e.g. "flat", "per hour", "per day" */
  unit: string;
}

interface PricePreviewCell {
  /** Pre-formatted price label e.g. "$530" */
  price: string;
  /** Duration label e.g. "3 hrs" */
  duration: string;
}

// ─── Mock seeds ────────────────────────────────────────────────────────

/**
 * Initial chat exchange shown when the user opens the tab. Mirrors the
 * Figma exactly — when the real AI lands the demo will be replaced
 * with whatever conversation the user actually had with the bot
 * (loaded from the product's pricing record).
 */
const INITIAL_CHAT: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    text: "first 3 hours is $530, then $200 per hour after that",
  },
  {
    id: "msg-2",
    role: "ai",
    text: [
      "Got it here's how I've structured that:",
      "First 3 hours: $530 flat",
      "Each additional hour: $200 per hour",
      "Does this look right? You can edit any tier below or describe it differently",
    ].join("\n"),
  },
];

/** Preset prompts shown under the chat as quick-fill chips. */
const TRY_EXAMPLES: string[] = [
  "first 3 hours is $530, then $200 per hour after that",
  "1-2 hours is $200, 3-4 hours is $350, every hour after that is 550",
  "first bay is $750, then every bay after is $150 extra",
  "$14 per sqm per week, additional weeks at 1.5x per extra week",
  "$280 per day, $180 half day, $380 overnight",
];

/**
 * Tiers shown in the Structured pricing card on first load. These
 * mirror the AI's parse of the demo prompt above so the flow makes
 * narrative sense (chat → confirmation → editable tiers).
 */
const INITIAL_TIERS: PricingTier[] = [
  { id: "tier-1", duration: "First 3 hours", rate: "530", unit: "flat" },
  { id: "tier-2", duration: "Each additional hour", rate: "200", unit: "per hour" },
];

/**
 * Read-only price preview cards. Hardcoded for V1; the real values
 * come from running the tiers through the pricing calc engine once
 * that lands.
 */
const PRICE_PREVIEW: PricePreviewCell[] = [
  { price: "$530", duration: "3 hrs" },
  { price: "$730", duration: "4 hrs" },
  { price: "$930", duration: "5 hrs" },
  { price: "$1130", duration: "6 hrs" },
  { price: "$1330", duration: "7 hrs" },
  { price: "$1530", duration: "8 hrs" },
];

// ─── Component ─────────────────────────────────────────────────────────

/**
 * Renders the full Pricing tab. State is owned locally for V1;
 * lift to the parent form via props when the API lands.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (Pricing tab)
 */
export function PricingTab() {
  // ── Chat state ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState("");
  const [activeExample, setActiveExample] = useState<string>(TRY_EXAMPLES[0]);

  // ── Pricing tier state ──────────────────────────────────────────────
  const [tiers, setTiers] = useState<PricingTier[]>(INITIAL_TIERS);

  // ── Side fields ─────────────────────────────────────────────────────
  const [publicHolidayRate, setPublicHolidayRate] = useState("");
  const [minHireDuration, setMinHireDuration] = useState("First tier only");

  // ── Discounting toggles ─────────────────────────────────────────────
  const [allowDiscounts, setAllowDiscounts] = useState(true);
  const [includeInBundles, setIncludeInBundles] = useState(true);

  // ── Handlers ────────────────────────────────────────────────────────

  /**
   * Appends the user message + a canned AI response. Mock for V1 —
   * the real implementation will POST the prompt to the AI engine,
   * parse the response into tiers, and call setTiers with the result.
   */
  const handleSend = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const baseId = Date.now().toString(36);
    setMessages((prev) => [
      ...prev,
      { id: `${baseId}-u`, role: "user", text: trimmed },
      {
        id: `${baseId}-a`,
        role: "ai",
        text: "Thanks — I've updated the structured pricing below. Let me know if any tier looks off.",
      },
    ]);
    setChatInput("");
  };

  const handleExampleClick = (example: string) => {
    setActiveExample(example);
    setChatInput(example);
  };

  const handleTierChange = (id: string, field: keyof PricingTier, value: string) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleRemoveTier = (id: string) => {
    if (tiers.length === 1) {
      toast.info("At least one pricing tier is required.");
      return;
    }
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        id: `tier-${Date.now().toString(36)}`,
        duration: "",
        rate: "",
        unit: "",
      },
    ]);
  };

  return (
    // Author: Puran
    // Impact: tightened outer gap from space-y-6 → space-y-4 so the
    //         Pricing tab is less of a scroll-fest. Six stacked cards
    //         add up fast — every gap removed here is real screen real
    //         estate the user gets back.
    <div className="space-y-4">
      {/* ── Section header ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">
          Describe your pricing
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Type your pricing rules in plain English exactly how you&rsquo;d
          explain it to someone. The AI will interpret it, ask if anything&rsquo;s
          unclear, and structure it automatically.
        </p>
      </div>

      {/* ── AI chat card ─────────────────────────────────────────────── */}
      <Card padding="md">
        {/* Instructional first line — not a chat bubble, more like a
            section intro that lives inside the card. Separator below. */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          How is this product priced? Just describe it naturally—eg.
          &ldquo;first 3 hours is $530, then $200 per hour after that&rdquo;
          or &ldquo;it&rsquo;s $14 per sqm per week&rdquo;. I&rsquo;ll
          interpret it and confirm.
        </p>
        <div className="mt-3 border-t border-slate-100" />

        {/* Chat scroll area */}
        <div className="mt-3 flex flex-col gap-3">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} text={msg.text} />
            ) : (
              <AiBubble key={msg.id} text={msg.text} />
            )
          )}
        </div>

        {/* Input row — input + Send button. Stacks on small screens
            so the Send button never sits on top of the input. */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Write here..."
              aria-label="Pricing description"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            className="sm:w-auto"
          >
            Send
          </Button>
        </div>
      </Card>

      {/* ── Try an example chips ─────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Try an example
        </p>
        {/* Author: Puran */}
        {/* Impact: chips can now wrap text on narrow viewports instead of */}
        {/*         overflowing the card */}
        {/* Reason: at iPhone 12 Pro (390px) the long "$14 per sqm…" chip */}
        {/*         exceeded the container width because of */}
        {/*         whitespace-nowrap + shrink-0. Switching to rounded-2xl */}
        {/*         + whitespace-normal + max-w-full lets long chips wrap */}
        {/*         their text into 2-3 lines while still looking like a */}
        {/*         chip. Short chips are unchanged. */}
        <div className="mt-3 flex flex-wrap items-start gap-2">
          {TRY_EXAMPLES.map((example) => {
            const active = example === activeExample;
            return (
              <button
                key={example}
                type="button"
                onClick={() => handleExampleClick(example)}
                className={[
                  "max-w-full inline-flex items-start text-left rounded-2xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  active
                    ? "border-[#1a2f6e]/40 bg-[#1a2f6e]/5 text-[#1a2f6e]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {example}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Structured pricing + Price preview (merged card) ─────────── */}
      {/* Author: Puran */}
      {/* Impact: merged "Structured pricing" and "Price preview" into a */}
      {/*         single card separated by a thin border */}
      {/* Reason: they describe the same thing (tiers in / preview out) */}
      {/*         and stacking them as two cards added ~80px of dead */}
      {/*         padding to a tab that was already too scroll-heavy */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Structured pricing</p>

        {/* Column headers — visible on md+, hidden on mobile (each row
            has its own labels in the stacked layout). */}
        <div className="mt-3 hidden md:grid grid-cols-[1.4fr_1fr_1fr_auto] gap-3 px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Duration/Condition
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rate
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unit
          </p>
          <span className="sr-only">Remove</span>
        </div>

        {/* Tier rows — desktop is a 4-col grid (3 inputs + delete),
            mobile stacks each input vertically with its label. */}
        <div className="mt-2 flex flex-col gap-3 md:gap-2">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 md:gap-3 md:items-center"
            >
              <div className="flex flex-col gap-1.5">
                <label className="md:hidden text-xs font-medium text-slate-500">
                  Duration / Condition
                </label>
                <Input
                  value={tier.duration}
                  onChange={(e) =>
                    handleTierChange(tier.id, "duration", e.target.value)
                  }
                  placeholder="e.g. First 3 hours"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="md:hidden text-xs font-medium text-slate-500">
                  Rate
                </label>
                <Input
                  value={tier.rate ? `$${tier.rate}` : ""}
                  onChange={(e) => {
                    // Strip the $ + non-digits so the underlying state
                    // stays a clean numeric string.
                    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                    handleTierChange(tier.id, "rate", cleaned);
                  }}
                  placeholder="$0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="md:hidden text-xs font-medium text-slate-500">
                  Unit
                </label>
                <Input
                  value={tier.unit}
                  onChange={(e) =>
                    handleTierChange(tier.id, "unit", e.target.value)
                  }
                  placeholder="e.g. per hour"
                />
              </div>
              <div className="flex justify-end md:justify-center md:items-center">
                <button
                  type="button"
                  onClick={() => handleRemoveTier(tier.id)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1a2f6e] text-slate-700 transition-colors hover:bg-[#1a2f6e]/5 cursor-pointer"
                  aria-label={`Remove tier ${tier.duration || "untitled"}`}
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
              </div>
            </div>
          ))}
        </div>

        {/* Add tier — outlined blue pill, matches the Figma. */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleAddTier}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 h-10 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
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
            Add tier manually
          </button>
        </div>

        {/* Inner separator dividing the structured pricing inputs from
            the price preview row. Replaces what used to be a card
            border so the two sections still feel distinct. */}
        <div className="mt-5 border-t border-slate-100" />

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Price Preview — what sales team sees
        </p>
        {/* Author: Puran */}
        {/* Impact: preview cells now use the brand-blue palette */}
        {/*         (`bg-blue-50` + `border-blue-300` + `text-blue`) */}
        {/*         matching the InfoBanner / AI bubble family */}
        {/* Reason: same source-of-truth principle as the AI bubble — */}
        {/*         every "info highlight" surface in the form uses */}
        {/*         the brand `#0062FF` family. The 5% navy tint I had */}
        {/*         was almost invisible against the card and didn't */}
        {/*         match the Figma's brighter blue cells. */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PRICE_PREVIEW.map((cell) => (
            <div
              key={cell.duration}
              className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-center"
            >
              <p className="text-base font-bold text-blue">{cell.price}</p>
              <p className="mt-0.5 text-xs text-slate-500">{cell.duration}</p>
            </div>
          ))}
        </div>

        {/* Public holiday rate + Minimum hire duration — two-column row,
            stacks on mobile. */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <Input
              label="Public holiday rate (optional override)"
              value={publicHolidayRate}
              onChange={(e) => setPublicHolidayRate(e.target.value)}
              placeholder="$ Leave blank to use global surcharge %"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Overrides the gate PH surcharge for this product only
            </p>
          </div>
          <div>
            <Input
              label="Minimum hire duration"
              value={minHireDuration}
              onChange={(e) => setMinHireDuration(e.target.value)}
              placeholder="First tier only"
            />
          </div>
        </div>
      </Card>

      {/* ── Discounting card ─────────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold text-slate-900">Discounting</p>

        <div className="mt-3 flex flex-col divide-y divide-slate-100">
          <ToggleRow
            title="Allow discounts on this product"
            description="If off, global discount rules do not apply — always sold at full price."
            checked={allowDiscounts}
            onChange={() => setAllowDiscounts((v) => !v)}
          />
          <ToggleRow
            title="Include in bundle pricing"
            description="Can be included in bundles and contributes its base price to the bundle total."
            checked={includeInBundles}
            onChange={() => setIncludeInBundles((v) => !v)}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

/**
 * User chat bubble — right-aligned, light slate bg, with a "You"
 * caption below it. Mirrors the Figma exactly.
 */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
        {text}
      </div>
      <p className="mt-1 text-xs text-slate-400">You</p>
    </div>
  );
}

/**
 * AI chat bubble — left-aligned, brand-blue bg + border, navy "Ai"
 * avatar circle preceding the bubble. The text supports newlines so
 * the structured-pricing reply can render as multiple lines.
 *
 * Author: Puran
 * Impact: switched bubble bg + border from a 5% navy tint to the
 *         brand-blue palette (`bg-blue-50` + `border-blue-300`)
 *         matching the rest of the form's info-banner family
 * Reason: Figma calls for the brighter brand `#0062FF` family on
 *         the AI bubble, not the dark navy tint I had. Same colour
 *         the InfoBanner shells, the SummaryChip primary, and the
 *         Pricing preview numbers all use — single source of truth.
 *         The Ai avatar circle stays dark navy because it reads as
 *         "branded UI chrome" rather than an info highlight.
 */
function AiBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2f6e] text-[10px] font-bold text-white">
        Ai
      </div>
      <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl bg-blue-50 border border-blue px-4 py-3 text-sm text-slate-800 whitespace-pre-line">
        {text}
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
 * Reusable title + description + switch row used inside the
 * Discounting card. Same switch language as the Configurable product
 * toggle on Basic Info.
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
