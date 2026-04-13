"use client";

/**
 * Conditional rules UI for Inventory → Component parts → Conditional rules.
 * Client-only state until product inventory rules API exists.
 */

import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";

// ─── Types ─────────────────────────────────────────────────────────────

export interface RuleConditionRow {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface RuleActionRow {
  id: string;
  action: "add" | "remove";
  itemName: string;
  qtyLogic: string;
  qty: string;
  /** e.g. "Legs" — shown as small badge in wide layouts */
  unitRef: string;
  /** e.g. "1 per drum" — secondary quantity hint */
  secondaryRef: string;
  note: string;
}

export interface ConditionalRule {
  id: string;
  title: string;
  scope: "per_item" | "per_order";
  enabled: boolean;
  conditions: RuleConditionRow[];
  actions: RuleActionRow[];
}

const CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: "surface_type", label: "Surface type" },
  { value: "anchoring_type", label: "Anchoring type" },
  { value: "job_duration", label: "Job duration" },
  { value: "structure_type", label: "Structure type" },
];

const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: "is_any_of", label: "is any of" },
  { value: "equals", label: "equals" },
  { value: "is_not", label: "is not" },
];

const ACTION_QTY_LOGIC: { value: string; label: string }[] = [
  { value: "fixed", label: "Fixed qty" },
  { value: "per_anchor", label: "1 per anchor point" },
  { value: "per_leg", label: "1 per leg" },
  { value: "per_drum", label: "1 per drum" },
  { value: "per_crew", label: "Per crew" },
];

const RULES_INFO_COPY =
  "Rules are evaluated in order. Each rule can add, remove, replace, or scale components on the load list based on job details. Later rules can override earlier ones.";

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const INITIAL_CONDITIONAL_RULES: ConditionalRule[] = [
  {
    id: "rule-seed-1",
    title: "Concrete / Artificial grass — replace pegs with sandbags",
    scope: "per_item",
    enabled: true,
    conditions: [
      {
        id: "c1",
        field: "surface_type",
        operator: "is_any_of",
        value: "concrete, artificial_grass",
      },
    ],
    actions: [
      {
        id: "a1",
        action: "remove",
        itemName: "Steel pegs",
        qtyLogic: "fixed",
        qty: "6",
        unitRef: "",
        secondaryRef: "",
        note: "Not suitable for hard surfaces",
      },
      {
        id: "a2",
        action: "remove",
        itemName: "Hammer",
        qtyLogic: "fixed",
        qty: "1",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
      {
        id: "a3",
        action: "add",
        itemName: "Sandbags",
        qtyLogic: "fixed",
        qty: "4",
        unitRef: "",
        secondaryRef: "",
        note: "Use weighted bags instead of pegs",
      },
    ],
  },
  {
    id: "rule-seed-2",
    title: "Water drum anchoring — replace with water barrels",
    scope: "per_item",
    enabled: true,
    conditions: [
      {
        id: "c2",
        field: "anchoring_type",
        operator: "equals",
        value: "water_drums",
      },
    ],
    actions: [
      {
        id: "a4",
        action: "remove",
        itemName: "Steel pegs",
        qtyLogic: "fixed",
        qty: "6",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
      {
        id: "a5",
        action: "add",
        itemName: "Sandbags",
        qtyLogic: "per_anchor",
        qty: "1",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
      {
        id: "a6",
        action: "add",
        itemName: "Hammer",
        qtyLogic: "fixed",
        qty: "1",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
      {
        id: "a7",
        action: "add",
        itemName: "Long ratchets",
        qtyLogic: "per_leg",
        qty: "1",
        unitRef: "Legs",
        secondaryRef: "1 per drum",
        note: "",
      },
      {
        id: "a8",
        action: "add",
        itemName: "Water drum covers",
        qtyLogic: "per_drum",
        qty: "1",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
    ],
  },
];

export function emptyConditionalRule(): ConditionalRule {
  return {
    id: newId("rule"),
    title: "New rule",
    scope: "per_item",
    enabled: true,
    conditions: [
      {
        id: newId("cond"),
        field: "surface_type",
        operator: "is_any_of",
        value: "",
      },
    ],
    actions: [
      {
        id: newId("act"),
        action: "add",
        itemName: "",
        qtyLogic: "fixed",
        qty: "",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
    ],
  };
}

interface ConditionalRulesPanelProps {
  rules: ConditionalRule[];
  onRulesChange: (next: ConditionalRule[]) => void;
}

export function ConditionalRulesPanel({
  rules,
  onRulesChange,
}: ConditionalRulesPanelProps) {
  const updateRule = (ruleId: string, patch: Partial<ConditionalRule>) => {
    onRulesChange(
      rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    );
  };

  const removeRule = (ruleId: string) => {
    if (rules.length <= 1) return;
    onRulesChange(rules.filter((r) => r.id !== ruleId));
  };

  const addRule = () => {
    onRulesChange([...rules, emptyConditionalRule()]);
  };

  return (
    <div className="flex flex-col gap-5">
      <RulesInfoBanner text={RULES_INFO_COPY} />

      <div className="flex flex-col gap-5">
        {rules.map((rule, ruleIndex) => (
          <RuleCard
            key={rule.id}
            index={ruleIndex + 1}
            rule={rule}
            onChange={(patch) => updateRule(rule.id, patch)}
            onRemove={() => removeRule(rule.id)}
            canRemove={rules.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#1a2f6e] bg-white text-sm font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
      >
        <PlusIcon />
        Add rule
      </button>
    </div>
  );
}

function RulesInfoBanner({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: "#FF9F2940", backgroundColor: "#FF9F2910" }}>
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          style={{ color: "#FF9F29" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.723 7.723 0 010-.255c.007-.379-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-sm leading-relaxed" style={{ color: "#7A4500" }}>{text}</p>
      </div>
    </div>
  );
}

interface RuleCardProps {
  index: number;
  rule: ConditionalRule;
  onChange: (patch: Partial<ConditionalRule>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function RuleCard({
  index,
  rule,
  onChange,
  onRemove,
  canRemove,
}: RuleCardProps) {
  const setConditions = (conditions: RuleConditionRow[]) =>
    onChange({ conditions });
  const setActions = (actions: RuleActionRow[]) => onChange({ actions });

  const addCondition = () => {
    setConditions([
      ...rule.conditions,
      {
        id: newId("cond"),
        field: "surface_type",
        operator: "equals",
        value: "",
      },
    ]);
  };

  const updateCondition = (id: string, patch: Partial<RuleConditionRow>) => {
    setConditions(
      rule.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const removeCondition = (id: string) => {
    if (rule.conditions.length <= 1) return;
    setConditions(rule.conditions.filter((c) => c.id !== id));
  };

  const addAction = () => {
    setActions([
      ...rule.actions,
      {
        id: newId("act"),
        action: "add",
        itemName: "",
        qtyLogic: "fixed",
        qty: "",
        unitRef: "",
        secondaryRef: "",
        note: "",
      },
    ]);
  };

  const updateAction = (id: string, patch: Partial<RuleActionRow>) => {
    setActions(
      rule.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  };

  const removeAction = (id: string) => {
    if (rule.actions.length <= 1) return;
    setActions(rule.actions.filter((a) => a.id !== id));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="hidden pt-1 text-slate-400 sm:block">
            <DragHandleIcon />
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-sm font-bold text-white">
            {index}
          </div>
          <div className="min-w-0 flex-1">
            <Input
              value={rule.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Rule title"
              inputClassName="text-base font-semibold"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ScopePill
            value={rule.scope}
            onChange={(v) => onChange({ scope: v as ConditionalRule["scope"] })}
          />
          <RuleSwitch
            checked={rule.enabled}
            onChange={() => onChange({ enabled: !rule.enabled })}
            ariaLabel={`Enable rule ${index}`}
          />
          {canRemove && (
            <RemoveIconButton
              onClick={onRemove}
              label={`Remove rule ${index}`}
            />
          )}
        </div>
      </div>

      {/* IF */}
      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          IF (Conditions)
        </p>
        <div className="flex flex-col gap-3">
          {rule.conditions.map((cond) => (
            <div
              key={cond.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
            >
              <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-600">
                WHERE
              </span>
              <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                <StyledSelect
                  value={cond.field}
                  onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                  aria-label="Condition field"
                  className="text-base"
                >
                  {CONDITION_FIELDS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="min-w-[9rem] flex-1 sm:max-w-[12rem]">
                <StyledSelect
                  value={cond.operator}
                  onChange={(e) =>
                    updateCondition(cond.id, { operator: e.target.value })
                  }
                  aria-label="Condition operator"
                  className="text-base"
                >
                  {CONDITION_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="min-w-0 flex-[2]">
                <Input
                  value={cond.value}
                  onChange={(e) =>
                    updateCondition(cond.id, { value: e.target.value })
                  }
                  placeholder="concrete, artificial_grass"
                  inputClassName="text-base"
                />
              </div>
              <div className="flex justify-end sm:justify-center">
                <RemoveIconButton
                  onClick={() => removeCondition(cond.id)}
                  label="Remove condition"
                  disabled={rule.conditions.length <= 1}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
        >
          <PlusIcon />
          And condition
        </button>
      </div>

      {/* THEN */}
      <div className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          THEN (Actions)
        </p>
        <div className="flex flex-col gap-3">
          {rule.actions.map((act) => (
            <div
              key={act.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 lg:grid lg:grid-cols-[minmax(5rem,6rem)_minmax(0,1.4fr)_minmax(9rem,11rem)_minmax(4.5rem,5rem)_minmax(4.5rem,5rem)_minmax(4.5rem,5.5rem)_minmax(0,1.2fr)_auto] lg:items-center lg:gap-3"
            >
              <div className="lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Action
                </span>
                <StyledSelect
                  value={act.action}
                  onChange={(e) =>
                    updateAction(act.id, {
                      action: e.target.value as RuleActionRow["action"],
                    })
                  }
                  aria-label="Action type"
                  className="text-base"
                >
                  <option value="remove">Remove</option>
                  <option value="add">Add</option>
                </StyledSelect>
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Item
                </span>
                <Input
                  value={act.itemName}
                  onChange={(e) =>
                    updateAction(act.id, { itemName: e.target.value })
                  }
                  placeholder="Steel pegs"
                  inputClassName="text-base"
                />
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Qty logic
                </span>
                <StyledSelect
                  value={act.qtyLogic}
                  onChange={(e) =>
                    updateAction(act.id, { qtyLogic: e.target.value })
                  }
                  aria-label="Quantity logic"
                  className="text-base"
                >
                  {ACTION_QTY_LOGIC.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Qty
                </span>
                <Input
                  value={act.qty}
                  onChange={(e) =>
                    updateAction(act.id, { qty: e.target.value })
                  }
                  placeholder="qty"
                  inputClassName="text-base"
                />
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Unit
                </span>
                <Input
                  value={act.unitRef}
                  onChange={(e) =>
                    updateAction(act.id, { unitRef: e.target.value })
                  }
                  placeholder="Legs"
                  inputClassName="text-center text-base"
                />
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Extra
                </span>
                <Input
                  value={act.secondaryRef}
                  onChange={(e) =>
                    updateAction(act.id, { secondaryRef: e.target.value })
                  }
                  placeholder="1 per drum"
                  inputClassName="text-base"
                />
              </div>
              <div className="min-w-0 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600 lg:hidden">
                  Note
                </span>
                <Input
                  value={act.note}
                  onChange={(e) => updateAction(act.id, { note: e.target.value })}
                  placeholder="Note..."
                  inputClassName="text-base"
                />
              </div>
              <div className="flex justify-end lg:justify-center">
                <RemoveIconButton
                  onClick={() => removeAction(act.id)}
                  label="Remove action"
                  disabled={rule.actions.length <= 1}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAction}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#1a2f6e] bg-white px-4 text-xs font-semibold text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
        >
          <PlusIcon />
          And action
        </button>
      </div>
    </div>
  );
}

/** Small pill matching the Figma "Per item" badge next to each rule header. */
function ScopePill({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Rule scope"
        className="h-8 cursor-pointer appearance-none rounded-full border border-slate-300 bg-slate-50 py-0 pl-3 pr-8 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 focus:border-[#1a2f6e] focus:outline-none focus:ring-2 focus:ring-[#1a2f6e]/20"
      >
        <option value="per_item">Per item</option>
        <option value="per_order">Per order</option>
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function RuleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#042E93]/40",
        checked ? "bg-[#042E93]" : "bg-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function RemoveIconButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#1a2f6e] text-slate-700 transition-colors hover:bg-[#1a2f6e]/5 disabled:pointer-events-none disabled:opacity-40"
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
