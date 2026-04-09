// Old Author: jay
// New Author: samir
// Impact: made layout fully responsive with mobile hamburger menu, adaptive padding, and full-width content area
// Reason: layout was desktop-only with fixed padding and capped at 1512px; now works on 320px+ screens and stretches on ultra-wide displays

"use client";

import { usePathname, useRouter } from "next/navigation";
import AdminSidebarWrapper from "@/components/admin/AdminSidebarWrapper";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/admin/AdminSidebarWrapper";

// Old Author: Puran
// New Author: Puran
// Impact: derive sticky-header title from the current route instead of
//         hard-coding "Org Setup" for every page; optional back arrow
//         per route for detail / edit screens
// Reason: every dashboard page was rendering "Org Setup" in the outer
//         sticky bar regardless of where the user actually was — broke
//         the Figma for Products / Bundles / etc. Mapping by pathname
//         keeps the outer bar honest without forcing each page to wire
//         a context provider just for one string. The `back` flag is
//         set on detail-style routes (e.g. product edit) so the sticky
//         bar grows a back arrow next to the title without each page
//         needing to render its own "go back" affordance.
//
// IMPORTANT: order matters — the FIRST regex match wins, so put more
// specific patterns BEFORE their parents (e.g. /products/[id]/edit
// must come before /products).
interface RouteTitle {
  match: RegExp;
  label: string;
  /** When true, the sticky bar renders a back arrow before the label */
  back?: boolean;
}

// Author: samir
// Impact: kept Puran's regex-based map but used "Roles & Permissions" instead
//         of just "Roles" for /dashboard/team/roles
// Reason: matches the in-page heading on the Roles screen and is what the
//         client asked for in the prior session
const ROUTE_TITLES: RouteTitle[] = [
  { match: /^\/dashboard\/org-setup/, label: "Org Setup" },
  { match: /^\/dashboard\/branding/, label: "Branding" },
  { match: /^\/dashboard\/team\/roles/, label: "Roles & Permissions" },
  { match: /^\/dashboard\/team\/members\/[^/]+\/edit/, label: "Edit Member", back: true },
  { match: /^\/dashboard\/team\/members/, label: "Team & Users" },
  { match: /^\/dashboard\/team/, label: "Team & Users" },
  { match: /^\/dashboard\/products\/new/, label: "Add Product", back: true },
  { match: /^\/dashboard\/products\/[^/]+\/edit/, label: "Product Details", back: true },
  { match: /^\/dashboard\/products/, label: "Products" },
  { match: /^\/dashboard\/bundles/, label: "Bundles & Packages" },
  { match: /^\/dashboard\/quote-templates/, label: "Quote Templates" },
  { match: /^\/dashboard\/pricing/, label: "Pricing & Rules" },
  { match: /^\/dashboard\/csv-import/, label: "CSV Import" },
  { match: /^\/dashboard$/, label: "Dashboard" },
];

/**
 * Resolves the page label + back-arrow flag for the sticky outer bar
 * from a pathname. Falls back to "Dashboard" so unknown routes still
 * render something sensible instead of an empty bar.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Dashboard - Layout
 */
function resolvePageTitle(pathname: string): { label: string; back: boolean } {
  const hit = ROUTE_TITLES.find((r) => r.match.test(pathname));
  return { label: hit?.label ?? "Dashboard", back: hit?.back ?? false };
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { setMobileOpen } = useMobileSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { label: title, back: showBack } = resolvePageTitle(pathname);

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
            {/* Author: Puran */}
            {/* Impact: per-route back arrow before the sticky title */}
            {/* Reason: detail / edit screens (Product Details, Edit */}
            {/*         Member, etc.) need a "go back" affordance in the */}
            {/*         outer bar matching the Figma. router.back() is */}
            {/*         intentionally used (not router.push) so the user */}
            {/*         lands on whatever screen they came from rather */}
            {/*         than a hard-coded parent. */}
            {showBack && (
              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
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
