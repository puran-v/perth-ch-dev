"use client";

/**
 * Client wrapper for AdminSidebar that fetches the current user
 * from GET /api/auth/me and handles logout.
 *
 * Replaces static defaultUser with real session data.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Dashboard Layout
 */

// Author: Puran
// Impact: wraps AdminSidebar with dynamic user data + logout
// Reason: sidebar profile was static; now shows real logged-in user

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          // Not authenticated — redirect to login
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.success && data.data) {
          setCurrentUser(data.data);
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  /**
   * Calls POST /api/auth/logout, clears cookie, redirects to login.
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
    } catch {
      // Even if the API call fails, redirect to login
    }
    router.push("/login");
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
