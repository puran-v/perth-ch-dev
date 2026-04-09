// Old Author: jay
// New Author: samir
// Impact: made layout fully responsive with mobile hamburger menu, adaptive padding, and full-width content area
// Reason: layout was desktop-only with fixed padding and capped at 1512px; now works on 320px+ screens and stretches on ultra-wide displays

"use client";

import { usePathname } from "next/navigation";
import AdminSidebarWrapper from "@/components/admin/AdminSidebarWrapper";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/admin/AdminSidebarWrapper";

// Author: samir
// Impact: pathname-keyed title map so the sticky header reflects the current page
// Reason: title was hardcoded to "Org Setup" — every page in the dashboard showed
//         the wrong label. Listed longest-prefix first so /dashboard/team/roles
//         falls through to the /dashboard/team entry, etc.
const PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/dashboard/org-setup", "Org Setup"],
  ["/dashboard/branding", "Branding"],
  ["/dashboard/team/roles", "Roles & Permissions"],
  ["/dashboard/team", "Team & Users"],
  ["/dashboard/products", "Products"],
  ["/dashboard/bundles", "Bundles"],
  ["/dashboard/pricing", "Pricing"],
  ["/dashboard/quote-templates", "Quote Templates"],
  ["/dashboard/csv-import", "CSV Import"],
  ["/dashboard", "Dashboard"],
];

/**
 * Resolve the sticky-header title from the current pathname. Falls back
 * to "Dashboard" so an unmapped sub-route never renders an empty header.
 *
 * @author samir
 * @created 2026-04-09
 * @module Dashboard - Layout
 */
function resolvePageTitle(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  for (const [prefix, title] of PAGE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return title;
    }
  }
  return "Dashboard";
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { setMobileOpen } = useMobileSidebar();
  const pathname = usePathname();

  function formatCurrentDate(): string {
    const now = new Date();
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  const notifications = 12;
  // Author: samir
  // Impact: title now follows the route instead of being hardcoded
  // Reason: see PAGE_TITLES above — the sticky header was always "Org Setup"
  const title = resolvePageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Author: samir */}
      {/* Impact: Suspense removed — AdminSidebarWrapper no longer uses useSearchParams */}
      {/* Reason: Suspense fallback was rendering null on hydration and flashing the sidebar on every hard refresh */}
      <AdminSidebarWrapper />
      <main className="flex-1 overflow-y-auto content-scrollbar bg-[#F8FAFC]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger button — visible on mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-bold text-slate-900 truncate">
              {title}
            </span>
            <span className="w-px h-4 bg-slate-300 hidden sm:block shrink-0" />
            <span className="text-sm text-slate-500 hidden sm:block truncate">
              {formatCurrentDate()}
            </span>
          </div>
          {notifications !== undefined && (
            <button
              className="relative flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
              aria-label="Notifications"
            >
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {notifications}
                </span>
              )}
            </button>
          )}
        </div>
        {/* Author: samir */}
        {/* Impact: full-width content area with responsive horizontal padding that scales up on ultra-wide screens */}
        {/* Reason: removed 1512px cap so the dashboard fills the viewport; added 2xl breakpoint padding to keep content from feeling stretched on 2560px+ displays */}
        <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-4 sm:py-6 2xl:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileSidebarProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </MobileSidebarProvider>
  );
}
