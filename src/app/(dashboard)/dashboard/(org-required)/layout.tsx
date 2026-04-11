// Author: samir
// Impact: server-component gate that redirects orphan users (logged in but with no orgId) to /dashboard/org-setup BEFORE any HTML for the gated page is sent to the browser
// Reason: AdminSidebarWrapper used to do this redirect inside a useEffect, which only fires after React renders the page on the client. The user could see the branding/team page content for ~200-500ms before the client-side router.replace() kicked in. Doing the check here in a server component means the redirect happens at request time and the user never sees the restricted content. Org-setup itself lives outside this route group so the user can always reach it.

import { redirect } from "next/navigation";
import { getServerComponentSession } from "@/server/lib/auth/guards";

/**
 * Layout for every dashboard page that requires the user to have
 * completed the Org Info step (i.e. has an orgId attached to their
 * user record). Pages inside this route group share this layout
 * automatically because (org-required) is a route group — it does
 * not appear in the URL.
 *
 * Behaviour matrix:
 * - No session at all → render children (the inner page or its own
 *   auth guard handles the unauthenticated case; this layout's job
 *   is org-completion, not authentication).
 * - Authenticated, has orgId → render children.
 * - Authenticated, no orgId  → redirect to /dashboard/org-setup
 *   server-side. The browser receives a 307 and never sees a flash
 *   of the gated page.
 *
 * @author samir
 * @created 2026-04-08
 * @module Auth - Dashboard Gate
 */
export default async function OrgRequiredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerComponentSession();

  // Only intercept the "logged in but no org" case. Unauthenticated
  // users keep flowing through to whatever auth guard the page itself
  // (or AdminSidebarWrapper) imposes — that's a separate concern.
  if (session && !session.orgId) {
    redirect("/dashboard/org-setup");
  }

  return <>{children}</>;
}
