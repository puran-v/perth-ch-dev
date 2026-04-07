// Author: samir
// Impact: added mobile responsive drawer with overlay, hamburger toggle support
// Reason: sidebar was fixed 280px with no mobile support; now collapses into a slide-out drawer on small screens

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OrgSetupIcon,
  TeamUsersIcon,
  BrandingIcon,
  ProductsIcon,
  BundlesIcon,
  QuoteTemplatesIcon,
  PricingRulesIcon,
  CsvImportIcon,
  InventoryIcon,
  WarehouseIcon,
  FinanceIcon,
  ChevronDownIcon,
} from "@/components/ui/SidebarIcons";

// --- Types ---

type BadgeType = "notification" | "status";

/**
 * Module tag for feature-area nav items. Items without a `module` field
 * are always visible (Setup pages, profile, etc). Items with a module
 * are filtered out by ModuleAccess when the user's role doesn't allow
 * that module — ADMIN users see everything because their module flags
 * are all true in the session context.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Sidebar
 */
export type NavItemModule = "A" | "B" | "C" | "D" | "E";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional module tag — item is hidden unless the user has this module enabled */
  module?: NavItemModule;
  badge?: {
    type: BadgeType;
    value: string | number;
  };
}

interface NavSection {
  heading: string;
  items: NavItem[];
  /**
   * If true, the whole section is only rendered for ADMIN users.
   * Used for the Setup group (Org Setup, Roles, Team & Users, Branding)
   * since org-level management is an ADMIN-only responsibility.
   */
  requiresAdmin?: boolean;
}

/** Per-module access flags — passed in from the AdminSidebarWrapper via /api/auth/me */
export interface SidebarModuleAccess {
  A: boolean;
  B: boolean;
  C: boolean;
  D: boolean;
  E: boolean;
}

interface ComingSoonModule {
  title: string;
  description: string;
}

interface TenantInfo {
  name: string;
  plan: string;
  tenantId: string;
}

interface UserInfo {
  name: string;
  role: string;
  avatarInitials: string;
  onLogout?: () => void;
}

interface AdminSidebarProps {
  tenant: TenantInfo;
  user: UserInfo;
  navSections: NavSection[];
  comingSoon: ComingSoonModule[];
  /** Whether the logged-in user is an ADMIN — drives section-level filtering */
  isAdmin: boolean;
  /** Per-module access flags from /api/auth/me — drives item-level filtering */
  modules: SidebarModuleAccess;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// --- Sub-components ---

function SidebarLogo() {
  return (
    <div className="flex items-center gap-2 px-6 pt-6 pb-2">
      <img
        src="/assets/logo.png"
        alt="The Fun Depot"
        className="h-8 w-auto"
      />
      <span className="text-white/60 text-sm">/</span>
      <span className="text-white text-sm font-medium">Operations</span>
    </div>
  );
}

function TenantSwitcher({ tenant }: { tenant: TenantInfo }) {
  return (
    <button className="mx-4 mt-4 mb-2 flex w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-left transition-colors hover:bg-white/15">
      <div className="flex items-center gap-3">
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-white leading-tight">
            {tenant.name}
          </p>
          <p className="text-xs text-white/50 leading-tight mt-0.5">
            {tenant.plan} · Tenant #{tenant.tenantId}
          </p>
        </div>
      </div>
      <ChevronDownIcon className="w-4 h-4 text-white/60" />
    </button>
  );
}

function NavBadge({ badge, isActive }: { badge: NavItem["badge"]; isActive: boolean }) {
  if (!badge) return null;

  if (badge.type === "notification") {
    return (
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white leading-none">
        {badge.value}
      </span>
    );
  }

  // status badge (e.g. "Incomplete", "Set Up") — orange on active, amber on dark bg
  return (
    <span className={`ml-auto text-xs font-medium ${isActive ? "text-orange-500" : "text-amber-300"}`}>
      {badge.value}
    </span>
  );
}

function SidebarNavItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={[
        "group flex items-center gap-3 rounded-[8px] px-3 py-2.5 font-inter text-[12px] font-bold leading-[170%] tracking-[0.2px] align-middle transition-colors",
        isActive
          ? "bg-white text-[#042E93]"
          : "text-white/70 hover:bg-white/8 hover:text-white",
      ].join(" ")}
    >
      <item.icon
        className={[
          "w-5 h-5 shrink-0 transition-colors",
          isActive ? "text-[#042E93]" : "text-white/50 group-hover:text-white/70",
        ].join(" ")}
      />
      <span className={`${isActive ? "text-[#042E93]": "text-white "}`}>{item.label}</span>
      <NavBadge badge={item.badge} isActive={isActive} />
    </Link>
  );
}

function SidebarNavSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  return (
    <div className="mt-5">
      <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {section.heading}
      </p>
      <nav className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
          />
        ))}
      </nav>
    </div>
  );
}

function ComingSoonCard({ module }: { module: ComingSoonModule }) {
  return (
    <div className="rounded-xl bg-white/8 px-4 py-3.5 border border-white/10">
      <p className="text-sm font-semibold text-white">{module.title}</p>
      <p className="text-xs text-white/40 mt-1 leading-relaxed">
        {module.description}
      </p>
    </div>
  );
}

// Old Author: jay
// New Author: Puran
// Impact: added logout button to user profile section
// Reason: users need to log out from sidebar; clears session cookie and redirects to login
function UserProfile({ user }: { user: UserInfo }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5 border-t border-white/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#042E93]">
        {user.avatarInitials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">
          {user.name}
        </p>
        <p className="text-xs text-white/50 truncate">{user.role}</p>
      </div>
      {user.onLogout && (
        <button
          onClick={user.onLogout}
          className="shrink-0 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Log out"
          title="Log out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      )}
    </div>
  );
}

// --- Main Component ---

export default function AdminSidebar({
  tenant,
  user,
  navSections,
  comingSoon,
  isAdmin,
  modules,
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  // Author: Puran
  // Impact: two-pass filter — drop admin-only sections for non-admins, then
  //         drop module-tagged items the user lacks access to, then drop any
  //         section that ends up empty (so non-admins don't see an orphaned
  //         "Setup" header with nothing under it)
  // Reason: sidebar must mirror the backend guards — users only see what they
  //         can actually reach, no dead links, no misleading entries
  const visibleSections = navSections
    .filter((section) => !section.requiresAdmin || isAdmin)
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.module || modules[item.module]
      ),
    }))
    .filter((section) => section.items.length > 0);

  const sidebarContent = (
    <aside className="flex h-screen w-[280px] shrink-0 flex-col bg-[#042E93] overflow-hidden">
      {/* Mobile close button */}
      <div className="lg:hidden flex justify-end px-4 pt-4">
        <button
          onClick={onMobileClose}
          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <SidebarLogo />
      <TenantSwitcher tenant={tenant} />

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 sidebar-scrollbar">
        {visibleSections.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-white">No access yet</p>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">
              Your role hasn&rsquo;t been granted access to any modules. Ask
              an admin to update your role.
            </p>
          </div>
        ) : (
          visibleSections.map((section) => (
            <SidebarNavSection
              key={section.heading}
              section={section}
              pathname={pathname}
            />
          ))
        )}

        {/* Coming Soon modules */}
        {comingSoon.length > 0 && (
          <div className="mt-6">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Coming Next
            </p>
            <div className="flex flex-col gap-2">
              {comingSoon.map((mod) => (
                <ComingSoonCard key={mod.title} module={mod} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User profile pinned to bottom */}
      <UserProfile user={user} />
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide-out drawer with overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="relative z-50 animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

// --- Default Configuration ---

export const defaultNavSections: NavSection[] = [
  {
    heading: "Setup",
    // Author: Puran
    // Impact: Setup section is now ADMIN-only
    // Reason: org-level management (create org, invite users, manage roles,
    //         branding) is the org owner's job — staff users should never see
    //         these entries even if they somehow navigate to the URLs the
    //         backend guards will reject them with FORBIDDEN
    requiresAdmin: true,
    items: [
      {
        label: "Org Setup",
        href: "/dashboard/org-setup",
        icon: OrgSetupIcon,
        badge: { type: "status", value: "Incomplete" },
      },
      // Author: Puran
      // Impact: surfaced Roles as a top-level sidebar entry (above Team & Users)
      // Reason: roles are created before inviting — easier discovery as its own link
      {
        label: "Roles",
        href: "/dashboard/team/roles",
        icon: TeamUsersIcon,
      },
      {
        label: "Team & Users",
        href: "/dashboard/team",
        icon: TeamUsersIcon,
      },
      {
        label: "Branding",
        href: "/dashboard/branding",
        icon: BrandingIcon,
      },
    ],
  },
  {
    heading: "Module A — Quoting",
    items: [
      {
        label: "Products",
        href: "/dashboard/products",
        icon: ProductsIcon,
        module: "A",
      },
      {
        label: "Bundles & Packages",
        href: "/dashboard/bundles",
        icon: BundlesIcon,
        module: "A",
      },
      {
        label: "Quote Templates",
        href: "/dashboard/quote-templates",
        icon: QuoteTemplatesIcon,
        module: "A",
      },
      {
        label: "Pricing & Rules",
        href: "/dashboard/pricing",
        icon: PricingRulesIcon,
        module: "A",
        badge: { type: "status", value: "Set Up" },
      },
      {
        label: "CSV Import",
        href: "/dashboard/csv-import",
        icon: CsvImportIcon,
        module: "A",
      },
    ],
  },
];

export const defaultComingSoon: ComingSoonModule[] = [
  {
    title: "Module B — Inventory",
    description: "Staff, vehicles, substitution rules, cross-hire",
  },
  {
    title: "Module C — Warehouse",
    description: "Loading rules, readiness tasks, warehouse layout",
  },
  {
    title: "Module D — Finance",
    description: "Payment gateways, invoice templates, dispatch holds",
  },
];

export const defaultTenant: TenantInfo = {
  name: "Perthbouncycastlehire",
  plan: "Pro",
  tenantId: "001",
};

export const defaultUser: UserInfo = {
  name: "Sarah Johnson",
  role: "Operations Manager",
  avatarInitials: "SJ",
};
