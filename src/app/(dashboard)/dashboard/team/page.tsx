"use client";

/**
 * Team & Users page — hosts the Users / Invite / Pending tabs.
 *
 * Tab state lives in local useState — V1 does not deep-link individual
 * tabs. Counts on the Users + Pending tabs come from the same React
 * Query caches the tab bodies use, so there's no extra fetch.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */

// Old Author: Puran
// New Author: Puran
// Impact: pill-shaped tabs with inline counts (matching Figma) instead of
//         the underline-style tab bar
// Reason: client requested visual parity with the Figma — dark filled pill
//         for the active tab, plain text + count for inactive ones

import { useState } from "react";
import { UsersTab } from "@/components/team/UsersTab";
import { InviteTab } from "@/components/team/InviteTab";
import { PendingTab } from "@/components/team/PendingTab";
import { useMembers } from "@/hooks/team/useMembers";
import { useInvitations } from "@/hooks/team/useInvitations";

type Tab = "users" | "invite" | "pending";

interface TabConfig {
  id: Tab;
  label: string;
  /** Count to render inline as `Label (N)`. Hidden while undefined. */
  count?: number;
}

/**
 * Dashboard Team page. Renders the pill tab bar with live counts and
 * switches the body component on click.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Pages
 */
export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  // Same React Query hooks the tab bodies use — calling them here is
  // free because React Query dedupes by query key. The data shows up
  // in both places off a single fetch.
  const { data: members } = useMembers();
  const { data: invitations } = useInvitations();

  // Count only "actionable" pending invites — exclude consumed/revoked
  // even though the API already filters them. Defence in depth.
  const pendingCount = (invitations ?? []).filter(
    (i) => !i.consumedAt && !i.revokedAt
  ).length;

  // Counts are undefined while loading so we don't flash "(0)" before
  // the data arrives — the label just renders without a count for one
  // render cycle, then the count appears.
  const tabs: TabConfig[] = [
    { id: "users", label: "Users", count: members?.length },
    { id: "invite", label: "Invite" },
    { id: "pending", label: "Pending", count: pendingCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team &amp; Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage who has access to your organization.
        </p>
      </div>

      {/* Tab bar — pill-shaped buttons matching the Figma. Horizontally
          scrollable on very narrow screens via overflow-x-auto so the
          three pills never wrap onto two lines. */}
      <div
        role="tablist"
        aria-label="Team & Users sections"
        className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:gap-2"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 inline-flex items-center justify-center rounded-full px-5 h-10 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={[
                    "ml-1.5 text-sm font-medium",
                    active ? "text-white/80" : "text-slate-400",
                  ].join(" ")}
                >
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div>
        {activeTab === "users" && <UsersTab />}
        {activeTab === "invite" && (
          <InviteTab onInviteSuccess={() => setActiveTab("pending")} />
        )}
        {activeTab === "pending" && <PendingTab />}
      </div>
    </div>
  );
}
