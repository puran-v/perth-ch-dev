// Old Author: jay
// New Author: samir
// Impact: made layout fully responsive with mobile hamburger menu and adaptive padding
// Reason: layout was desktop-only with fixed padding; now works on 320px+ screens

"use client";

import { Suspense } from "react";
import AdminSidebarWrapper from "@/components/admin/AdminSidebarWrapper";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/admin/AdminSidebarWrapper";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { setMobileOpen } = useMobileSidebar();

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
  const title = "Org Setup";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Suspense required — AdminSidebarWrapper uses useSearchParams for OAuth toast */}
      <Suspense>
        <AdminSidebarWrapper />
      </Suspense>
      <main className="flex-1 overflow-y-auto content-scrollbar bg-[#F8FAFC]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger button — visible on mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
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
              className="relative flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors shrink-0"
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
        <div className="!max-w-[1512px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
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
