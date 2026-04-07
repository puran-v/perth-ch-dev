"use client";

/**
 * Client wrapper for AdminSidebar that fetches the current user
 * from GET /api/auth/me and handles logout with toast notifications.
 *
 * Shows welcome toast on OAuth login success (via ?oauth=success query param).
 * Shows goodbye toast on logout before redirecting to login page.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Dashboard Layout
 */

// Old Author: samir
// New Author: Puran
// Impact: switched from raw fetch to useCurrentUser React Query hook; pass
//         isAdmin + modules to AdminSidebar so section/item filtering works
// Reason: dynamic module-based permissions — the sidebar must mirror what
//         the backend guards allow so non-admins don't see unreachable links

import { useEffect, useState, createContext, useRef, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import AdminSidebar, {
  defaultNavSections,
  defaultComingSoon,
  defaultTenant,
  defaultUser,
} from "@/components/admin/AdminSidebar";
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";

// Author: samir
// Impact: added MobileSidebarContext for layout hamburger toggle
// Reason: layout needs to control sidebar open/close state on mobile
interface MobileSidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}

/**
 * Generates avatar initials from a full name (first + last initial).
 *
 * @param name - The user's full name
 * @returns Two-letter initials string (e.g. "PV" for "Puran Vishwakarma")
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Dashboard Layout
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Formats the user role for display (e.g. "ADMIN" → "Admin").
 *
 * @param role - The role enum string from the database
 * @returns Human-readable role label
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Dashboard Layout
 */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/** Path of the org-setup wizard — the only safe destination for orphan users */
const ORG_SETUP_PATH = "/dashboard/org-setup";

export default function AdminSidebarWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const {
    data: currentUser,
    error: currentUserError,
    isFetching: isFetchingCurrentUser,
  } = useCurrentUser();
  const { mobileOpen, setMobileOpen } = useMobileSidebar();
  const toastShown = useRef(false);

  // If /api/auth/me rejects (401), the session is gone — bounce to /login.
  // React Query reports this via `error` instead of throwing, so we watch it.
  useEffect(() => {
    if (currentUserError) {
      router.push("/login");
    }
  }, [currentUserError, router]);

  // Author: Puran
  // Impact: orphan ADMIN redirect — users without an orgId must complete
  //         org-setup before they can reach any tenant-scoped page
  // Reason: signup creates users with orgId=null (samir's PUT /api/org-setup
  //         creates the org on first save). Without this redirect, a freshly
  //         signed-up admin lands on /dashboard and every data query throws
  //         ORG_REQUIRED. We skip the redirect when they're already on the
  //         org-setup page (which works for orphans — auth-only) to avoid
  //         a navigation loop.
  //
  // Race guard: while the current-user query is *refetching* (e.g. right
  // after PUT /api/org-setup invalidates the cache), React Query keeps the
  // old data visible with isFetching=true. If we redirected based on the
  // stale data during that window, we'd bounce the user back to org-setup
  // before the new orgId lands. Waiting out the refetch fixes the loop.
  useEffect(() => {
    if (!currentUser) return;
    if (isFetchingCurrentUser) return;
    if (currentUser.orgId) return;
    if (pathname === ORG_SETUP_PATH) return;
    router.replace(ORG_SETUP_PATH);
  }, [currentUser, isFetchingCurrentUser, pathname, router]);

  // Author: samir
  // Impact: read ?oauth=success from window.location on first successful load
  // Reason: useSearchParams would force a Suspense boundary that flickers the
  //         sidebar on hard refresh; window.location is safe in an effect
  useEffect(() => {
    if (!currentUser || toastShown.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("oauth") === "success") {
      toastShown.current = true;
      toast.success(`Welcome, ${currentUser.fullName}!`);
      url.searchParams.delete("oauth");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [currentUser]);

  /**
   * Logs out the user: calls POST /api/auth/logout, shows toast,
   * clears cookie, and redirects to login page.
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Dashboard Layout
   */
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      toast.success("You have been logged out successfully.");
    } catch {
      toast.error("Logout failed. Please try again.");
    }
    // Drop the cached current user so the next login doesn't briefly
    // render the previous user's sidebar before /api/auth/me refetches
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    // Small delay so user sees the toast before redirect
    setTimeout(() => router.push("/login"), 800);
  };

  const user = currentUser
    ? {
        name: currentUser.fullName,
        // Prefer the org-role label (e.g. "Floor Manager") over the system
        // role enum — it's what the user actually identifies with.
        role: currentUser.organizationRoleName ?? formatRole(currentUser.role),
        avatarInitials: getInitials(currentUser.fullName),
        onLogout: handleLogout,
      }
    : { ...defaultUser, onLogout: handleLogout };

  // Permission inputs for the sidebar filter:
  //   - isAdmin controls whether the ADMIN-only Setup section is shown
  //   - modules controls which feature-area items within kept sections render
  // While currentUser is still loading we render in "nothing visible" mode
  // so we never flash admin-only links to a non-admin in the split second
  // before /api/auth/me resolves.
  const isAdmin = currentUser?.role === "ADMIN";
  const modules = currentUser?.modules ?? {
    A: false,
    B: false,
    C: false,
    D: false,
    E: false,
  };

  return (
    <AdminSidebar
      tenant={defaultTenant}
      user={user}
      navSections={defaultNavSections}
      comingSoon={defaultComingSoon}
      isAdmin={isAdmin}
      modules={modules}
      mobileOpen={mobileOpen}
      onMobileClose={() => setMobileOpen(false)}
    />
  );
}

// Author: samir
// Impact: provider component wraps layout to share mobile sidebar state
// Reason: hamburger button in layout header needs to toggle sidebar open state
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MobileSidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}
