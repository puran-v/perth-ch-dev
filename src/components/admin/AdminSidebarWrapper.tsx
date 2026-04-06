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

// Old Author: Puran
// New Author: samir
// Impact: removed useSearchParams to eliminate Suspense bailout that caused sidebar flicker on hard refresh
// Reason: useSearchParams forces the closest Suspense boundary to render its fallback (null) during hydration, making the 280px sidebar disappear/reappear and shift layout. Reading ?oauth=success from window.location.search inside the existing effect is equivalent and runs only on the client, so no Suspense is required.

import { useEffect, useState, createContext, useRef, useContext } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import AdminSidebar, {
  defaultNavSections,
  defaultComingSoon,
  defaultTenant,
  defaultUser,
} from "@/components/admin/AdminSidebar";

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

interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
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

export default function AdminSidebarWrapper() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const { mobileOpen, setMobileOpen } = useMobileSidebar();
  const toastShown = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.success && data.data) {
          setCurrentUser(data.data);

          // Author: samir
          // Impact: read ?oauth=success from window.location instead of useSearchParams
          // Reason: useSearchParams would require a Suspense boundary around the whole sidebar, and that boundary rendered null on hydration, causing the sidebar to flicker on hard refresh. window.location is safe here because useEffect runs client-only.
          const url = new URL(window.location.href);
          if (url.searchParams.get("oauth") === "success" && !toastShown.current) {
            toastShown.current = true;
            toast.success(`Welcome, ${data.data.fullName}!`);
            // Clean up the query param without page reload
            url.searchParams.delete("oauth");
            window.history.replaceState({}, "", url.pathname);
          }
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

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
    // Small delay so user sees the toast before redirect
    setTimeout(() => router.push("/login"), 800);
  };

  const user = currentUser
    ? {
        name: currentUser.fullName,
        role: formatRole(currentUser.role),
        avatarInitials: getInitials(currentUser.fullName),
        onLogout: handleLogout,
      }
    : { ...defaultUser, onLogout: handleLogout };

  return (
    <AdminSidebar
      tenant={defaultTenant}
      user={user}
      navSections={defaultNavSections}
      comingSoon={defaultComingSoon}
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
