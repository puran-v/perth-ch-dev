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
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { UsersTab } from "@/components/team/UsersTab";
import { InviteTab } from "@/components/team/InviteTab";
import { PendingTab } from "@/components/team/PendingTab";
import { useMembers } from "@/hooks/team/useMembers";
import { useInvitations } from "@/hooks/team/useInvitations";
import Button from "@/components/ui/Button";

// Author: Puran
// Impact: Team page becomes a real Module A onboarding step with Save & Draft +
//         Save & Continue at the bottom (mirrors the Branding page contract)
// Reason: client wants the Team step to plug into the org-setup stepper. Save
//         & Continue is gated on having at least one teammate (member or
//         pending invitation, excluding the founder) so the founder can't
//         skip past Team without ever inviting anyone.
const NEXT_STEP_HREF = "/dashboard/products";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("users");

  // Same React Query hooks the tab bodies use — calling them here is
  // free because React Query dedupes by query key. The data shows up
  // in both places off a single fetch.
  const { data: members, isLoading: membersLoading } = useMembers();
  const { data: invitations, isLoading: invitationsLoading } = useInvitations();

  // Count only "actionable" pending invites — exclude consumed/revoked
  // even though the API already filters them. Defence in depth.
  const pendingCount = (invitations ?? []).filter(
    (i) => !i.consumedAt && !i.revokedAt
  ).length;

  // Author: Puran
  // Impact: gate Save & Continue on having at least one teammate beyond the
  //         founder. Members already excludes the caller (members API filters
  //         id !== self), so any non-zero count means a real second person.
  //         Pending invitations also count — the founder shouldn't have to
  //         wait for an invite to be accepted before moving on, but they
  //         must have actually invited someone.
  // Reason: prevents skipping the Team step empty-handed during onboarding.
  const teammateCount = (members?.length ?? 0) + pendingCount;
  const hasTeammate = teammateCount > 0;
  const isLoadingCounts = membersLoading || invitationsLoading;

  /**
   * Save & Draft — Team has no form-level state of its own (invitations
   * persist on the Invite tab via their own mutation), so this is just a
   * confirmation toast that the user's progress is safe. Kept for visual
   * parity with the Branding / Org Info pages.
   *
   * @author Puran
   * @created 2026-04-07
   * @module Team - Pages
   */
  const handleSaveDraft = () => {
    toast.success("Team progress saved.");
  };

  /**
   * Save & Continue — refuses to advance unless the org has at least one
   * teammate (member or pending invitation, excluding the founder). On
   * success, navigates to the Products step.
   *
   * @author Puran
   * @created 2026-04-07
   * @module Team - Pages
   */
  const handleSaveContinue = () => {
    if (isLoadingCounts) return;
    if (!hasTeammate) {
      toast.error(
        "Add at least one teammate before continuing. Use the Invite tab to send an invitation."
      );
      // Nudge the user toward the right tab so they're not hunting for it.
      setActiveTab("invite");
      return;
    }
    router.push(NEXT_STEP_HREF);
  };

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

      {/* Author: Puran */}
      {/* Impact: Module A stepper buttons — same shape as the Branding page */}
      {/* Reason: Team is part of org-setup, so it needs Save & Draft + Save & */}
      {/*         Continue. Continue is gated on at least one teammate. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pb-6 sm:pb-8">
        <Button
          variant="outline"
          size="lg"
          onClick={handleSaveDraft}
          disabled={isLoadingCounts}
        >
          Save & Draft
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSaveContinue}
          disabled={isLoadingCounts}
        >
          <span className="flex items-center justify-center gap-2">
            Save & Continue
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Button>
      </div>
    </div>
  );
}
