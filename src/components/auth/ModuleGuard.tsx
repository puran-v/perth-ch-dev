"use client";

/**
 * ModuleGuard — client-side wrapper that renders its children only if the
 * logged-in user has access to the specified module.
 *
 * Wrap every feature-area page with this (Module A: Products, Bundles,
 * Quote Templates, Pricing, CSV Import). Admins bypass the check because
 * their module flags are all true in the session. Non-admins without the
 * module see a "No access" message and a link back to the dashboard.
 *
 * This is the frontend twin of server/lib/auth/guards.ts → requireModule.
 * The backend is still the source of truth — this just prevents users
 * from hitting a dead page and rendering nothing.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Module Guard
 */

// Author: Puran
// Impact: new shared wrapper for all module-gated pages
// Reason: every Module A-E page needs the same "can I see this?" check
//         — centralising it avoids 5+ copies of the same redirect logic

import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { CurrentUserModules } from "@/hooks/useCurrentUser";

interface ModuleGuardProps {
  /** Which module the wrapped page belongs to */
  module: keyof CurrentUserModules;
  children: React.ReactNode;
}

/** Pretty label for each module — used in the no-access message */
const MODULE_LABELS: Record<keyof CurrentUserModules, string> = {
  A: "Module A — Quoting",
  B: "Module B — Inventory",
  C: "Module C — Warehouse",
  D: "Module D — Finance",
  E: "Module E — Reports",
};

/**
 * Gates its children behind the user having `modules[module] === true`.
 * Loading state renders a minimal skeleton so pages don't flash empty.
 *
 * @param module - The module key (A/B/C/D/E) the page belongs to
 * @param children - The page contents to render when access is allowed
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Module Guard
 */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { data: currentUser, isLoading } = useCurrentUser();

  // While the user profile is loading, render a placeholder — never render
  // the page body before we know whether access is allowed
  if (isLoading || !currentUser) {
    return (
      <div className="animate-pulse">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-64 rounded bg-slate-100" />
      </div>
    );
  }

  // Access denied — show a clear message instead of rendering children
  if (!currentUser.modules[module]) {
    return (
      <div className="flex flex-col items-start gap-4 max-w-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-6 w-6 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16a2 2 0 001.73 3z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            You don&rsquo;t have access to {MODULE_LABELS[module]}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Your role &mdash;{" "}
            <span className="font-medium text-slate-900">
              {currentUser.organizationRoleName ?? currentUser.role}
            </span>{" "}
            &mdash; doesn&rsquo;t include this module. Ask an admin to update
            your role if you need access.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-full border border-[#1a2f6e] px-6 text-sm font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
