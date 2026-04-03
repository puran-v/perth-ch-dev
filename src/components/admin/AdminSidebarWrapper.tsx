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
// New Author: Puran
// Impact: added toast notifications for OAuth login success and logout
// Reason: consistent user feedback matching email/password login toast pattern

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import AdminSidebar, {
  defaultNavSections,
  defaultComingSoon,
  defaultTenant,
  defaultUser,
} from "@/components/admin/AdminSidebar";

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
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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

          // Show welcome toast for OAuth login (only once)
          if (searchParams.get("oauth") === "success" && !toastShown.current) {
            toastShown.current = true;
            toast.success(`Welcome, ${data.data.fullName}!`);
            // Clean up the query param without page reload
            const url = new URL(window.location.href);
            url.searchParams.delete("oauth");
            window.history.replaceState({}, "", url.pathname);
          }
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router, searchParams]);

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
    />
  );
}
