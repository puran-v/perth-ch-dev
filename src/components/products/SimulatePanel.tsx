"use client";

/**
 * Simulate sub-tab — Inventory → Component parts → Simulate.
 *
 * User picks job conditions (surface type, anchoring, structure,
 * duration, bay count, job type) and sees the computed final loading
 * list with colour-coded changes:
 *   - Green dot   = added by a conditional rule
 *   - Red line    = removed by a conditional rule (strikethrough)
 *   - Orange qty  = quantity changed by a rule
 *   - Grey dot    = base component, unchanged
 *
 * Logic is pure client-side for V1, same as the rest of Inventory.
 */

import { useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type { ConditionalRule } from "@/components/products/ConditionalRulesPanel";

// ─── Types ─────────────────────────────────────────────────────────────

export interface BaseComponentRow {
  id: string;
  name: string;
  quantity: string;
  qtyFormula?: string;
}

interface JobConditions {
  surfaceType: string;
  anchoringType: string;
  structureType: string;
  eventDuration: string;
  bayCount: string;
  jobType: string;
}

interface FinalRow {
  id: string;
  name: string;
  qty: number;
  /** "base" | "added" | "removed" | "qty_changed" */
  status: "base" | "added" | "removed" | "qty_changed";
  originalQty?: number;
}

// ─── Option lists ───────────────────────────────────────────────────────

const SURFACE_TYPES = ["Grass", "Concrete", "Artificial grass", "Pavers", "Sand"];
const ANCHORING_TYPES = ["Steel pegs", "Water drums", "Sandbags", "None required"];
const STRUCTURE_TYPES = ["Inflatable", "Marquee", "Gazebo", "Stage", "Other"];
const EVENT_DURATIONS = ["1–2 hours", "3–4 hours", "5–6 hours", "Full day", "Overnight"];
const JOB_TYPES = ["Standard", "Premium", "Corporate", "School / Community"];

// ─── Simulation engine ──────────────────────────────────────────────────

/** Normalise a string for loose matching (lower, trim, strip spaces). */
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/** Map a condition field key → the matching job condition value. */
function jobValue(field: string, conds: JobConditions): string {
  switch (field) {
    case "surface_type":    return conds.surfaceType;
    case "anchoring_type":  return conds.anchoringType;
    case "structure_type":  return conds.structureType;
    case "job_duration":    return conds.eventDuration;
    case "bay_count":       return conds.bayCount;
    case "job_type":        return conds.jobType;
    default:                return "";
  }
}

/** Evaluate one condition row against the current job conditions. */
function evalCondition(
  field: string,
  operator: string,
  value: string,
  job: JobConditions,
): boolean {
  const jv = norm(jobValue(field, job));
  const cv = value.split(",").map((v) => norm(v.trim()));
  switch (operator) {
    case "is_any_of": return cv.some((v) => jv.includes(v) || v.includes(jv));
    case "equals":    return cv.some((v) => v === jv);
    case "is_not":    return cv.every((v) => v !== jv);
    default:          return false;
  }
}

/** Returns true if ALL conditions in the rule match. */
function ruleMatches(rule: ConditionalRule, job: JobConditions): boolean {
  return rule.enabled && rule.conditions.every((c) =>
    evalCondition(c.field, c.operator, c.value, job),
  );
}

/** Apply enabled, matching rules to base list → final list. */
function simulate(
  base: BaseComponentRow[],
  rules: ConditionalRule[],
  job: JobConditions,
): FinalRow[] {
  const rows: FinalRow[] = base.map((b) => ({
    id: b.id,
    name: b.name,
    qty: parseInt(b.quantity, 10) || 1,
    status: "base" as const,
  }));

  for (const rule of rules) {
    if (!ruleMatches(rule, job)) continue;
    for (const act of rule.actions) {
      if (act.action === "remove") {
        const idx = rows.findIndex(
          (r) => norm(r.name) === norm(act.itemName) && r.status !== "removed",
        );
        if (idx !== -1) {
          rows[idx] = { ...rows[idx], status: "removed" };
        }
      } else if (act.action === "add") {
        const existing = rows.findIndex(
          (r) => norm(r.name) === norm(act.itemName),
        );
        const newQty = parseInt(act.qty, 10) || 1;
        if (existing !== -1 && rows[existing].status !== "removed") {
          const old = rows[existing].qty;
          if (old !== newQty) {
            rows[existing] = {
              ...rows[existing],
              qty: newQty,
              originalQty: old,
              status: "qty_changed",
            };
          }
        } else if (existing === -1) {
          rows.push({
            id: `sim-${norm(act.itemName)}-${Date.now()}`,
            name: act.itemName || "New item",
            qty: newQty,
            status: "added",
          });
        } else {
          // was removed then re-added — treat as added
          rows[existing] = {
            ...rows[existing],
            qty: newQty,
            status: "added",
          };
        }
      }
    }
  }

  return rows;
}

// ─── Component ─────────────────────────────────────────────────────────

interface SimulatePanelProps {
  baseRows: BaseComponentRow[];
  conditionalRules: ConditionalRule[];
}

export function SimulatePanel({ baseRows, conditionalRules }: SimulatePanelProps) {
  const [job, setJob] = useState<JobConditions>({
    surfaceType: "Grass",
    anchoringType: "Steel pegs",
    structureType: "Inflatable",
    eventDuration: "3–4 hours",
    bayCount: "3",
    jobType: "Standard",
  });

  const set = (key: keyof JobConditions) => (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>,
  ) => setJob((prev) => ({ ...prev, [key]: e.target.value }));

  const final = useMemo(
    () => simulate(baseRows, conditionalRules, job),
    [baseRows, conditionalRules, job],
  );

  const onTruck   = final.filter((r) => r.status !== "removed").length;
  const addedCount   = final.filter((r) => r.status === "added").length;
  const removedCount = final.filter((r) => r.status === "removed").length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Info banner — green ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-emerald-600"
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
          <p className="text-sm leading-relaxed text-emerald-800">
            Set the job conditions and see the exact loading list. Green = added by rule, red strikethrough = removed, orange = quantity changed.
          </p>
        </div>
      </div>

      {/* ── Job conditions card ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-900">Job conditions</h4>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <ConditionField label="Surface type">
            <StyledSelect value={job.surfaceType} onChange={set("surfaceType")} aria-label="Surface type" className="text-base">
              {SURFACE_TYPES.map((o) => <option key={o}>{o}</option>)}
            </StyledSelect>
          </ConditionField>

          <ConditionField label="Anchoring type">
            <StyledSelect value={job.anchoringType} onChange={set("anchoringType")} aria-label="Anchoring type" className="text-base">
              {ANCHORING_TYPES.map((o) => <option key={o}>{o}</option>)}
            </StyledSelect>
          </ConditionField>

          <ConditionField label="Structure type">
            <StyledSelect value={job.structureType} onChange={set("structureType")} aria-label="Structure type" className="text-base">
              {STRUCTURE_TYPES.map((o) => <option key={o}>{o}</option>)}
            </StyledSelect>
          </ConditionField>

          <ConditionField label="Event duration">
            <StyledSelect value={job.eventDuration} onChange={set("eventDuration")} aria-label="Event duration" className="text-base">
              {EVENT_DURATIONS.map((o) => <option key={o}>{o}</option>)}
            </StyledSelect>
          </ConditionField>

          <ConditionField label="Bay count">
            <Input
              value={job.bayCount}
              onChange={set("bayCount")}
              placeholder="e.g. 3"
              inputMode="numeric"
              inputClassName="text-base"
            />
          </ConditionField>

          <ConditionField label="Job type">
            <StyledSelect value={job.jobType} onChange={set("jobType")} aria-label="Job type" className="text-base">
              {JOB_TYPES.map((o) => <option key={o}>{o}</option>)}
            </StyledSelect>
          </ConditionField>
        </div>
      </div>

      {/* ── Final loading list card ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Final loading list</h4>
          <p className="text-xs text-slate-500">
            {onTruck} item{onTruck !== 1 ? "s" : ""} on truck
            {" · "}
            {addedCount} added by rules
            {" · "}
            {removedCount} removed
          </p>
        </div>

        {/* Scope note */}
        <p className="px-5 pb-2 pt-3 text-xs italic text-slate-400">
          Per item — goes on truck for each unit of this product
        </p>

        {/* Rows — match Figma: thin dividers, small dot, name, ×qty right */}
        <ul className="divide-y divide-slate-100">
          {final.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-5 py-3">
              {/* Status dot */}
              <span
                className={[
                  "h-3.5 w-3.5 shrink-0 rounded-full",
                  row.status === "added"       ? "bg-emerald-400"  :
                  row.status === "removed"     ? "bg-red-300"      :
                  row.status === "qty_changed" ? "bg-orange-300"   :
                                                 "bg-slate-200",
                ].join(" ")}
              />

              {/* Name */}
              <span
                className={[
                  "flex-1 text-sm",
                  row.status === "removed"
                    ? "text-red-400 line-through"
                    : row.status === "added"
                    ? "text-emerald-700"
                    : "text-slate-800",
                ].join(" ")}
              >
                {row.name}
              </span>

              {/* Qty */}
              <span
                className={[
                  "shrink-0 text-sm tabular-nums",
                  row.status === "removed"     ? "text-red-400"    :
                  row.status === "added"       ? "text-emerald-600":
                  row.status === "qty_changed" ? "text-orange-600" :
                                                 "text-slate-600",
                ].join(" ")}
              >
                {row.status === "qty_changed" && row.originalQty !== undefined ? (
                  <>
                    <span className="mr-1.5 text-slate-400 line-through">
                      ×{row.originalQty}
                    </span>
                    ×{row.qty}
                  </>
                ) : (
                  <>×{row.qty}</>
                )}
              </span>
            </li>
          ))}
          {final.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              No base components defined yet.
            </li>
          )}
        </ul>
        <div className="h-3" />
      </div>
    </div>
  );
}

function ConditionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
