/**
 * POST /api/auth/accept-invitation
 *
 * Consumes a valid invitation token, creates the invited user account,
 * attaches them to the inviting org + role, marks the invitation consumed,
 * and issues a session cookie so the user is logged in immediately after
 * accepting.
 *
 * Idempotency & safety:
 *  - Token is consumed in the same transaction as user creation, so a double
 *    submit hits INVALID_OR_EXPIRED_TOKEN on the second attempt (stable code).
 *  - NO_EXPIRY_SENTINEL (year 2099) is always `> now`, so it naturally satisfies
 *    the "not expired" predicate without special casing.
 *  - If a user with the invited email already exists (anywhere — email is
 *    globally unique), returns EMAIL_ALREADY_REGISTERED so the FE can route
 *    them to login instead.
 *  - Unique-constraint races on user.email are caught as P2002 and mapped to
 *    the same EMAIL_ALREADY_REGISTERED code.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Accept Invitation
 */

// Author: Puran
// Impact: new endpoint closing the invite → mail → accept loop
// Reason: backend vertical for Team & Users V1 smoke test

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { acceptInvitationSchema } from "@/server/lib/validation/auth";
import { resetPasswordLimiter } from "@/server/lib/rate-limit";
import { hashInvitationToken } from "@/server/lib/team/invitationToken";
import {
  createSession,
  sessionCookieHeader,
} from "@/server/lib/auth/session";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/auth/accept-invitation";

/**
 * Accepts an invitation, provisions the user, and logs them in.
 *
 * Flow:
 *   1. Rate limit (reuses resetPasswordLimiter — same risk profile)
 *   2. Validate body (token, fullName, password)
 *   3. Hash token + bcrypt password in parallel
 *   4. Look up invitation by tokenHash (pending, not expired)
 *   5. Reject if a user with invitation.email already exists
 *   6. Transaction: create user (STAFF, verified) + mark invitation consumed
 *   7. Create session and return with Set-Cookie header
 *
 * @param req - The incoming request with { token, fullName, password }
 * @returns User data (201) + Set-Cookie, or a stable error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Accept Invitation
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Rate limit — token endpoint, same risk as reset-password
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed } = await resetPasswordLimiter.limit(ip);

    if (!allowed) {
      logger.warn("Accept invitation rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Step 2: Validate input
    const body = await req.json();
    const parsed = acceptInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const { token, fullName, password } = parsed.data;

    // Step 3: Hash token + bcrypt password in parallel — bcrypt is ~100-200ms,
    // lookup is ~10-30ms; running them together saves wall-clock time.
    const tokenHash = hashInvitationToken(token);

    const [invitation, passwordHash] = await Promise.all([
      db.invitation.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          deletedAt: null,
          // NO_EXPIRY_SENTINEL is year 2099 so this check naturally allows it
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          orgId: true,
          email: true,
          organizationRoleId: true,
          // Identity fields captured at invite time. The admin entered
          // these when sending the invitation; we use them as the truth
          // source so the invitee never has to retype their own name.
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      }),
      bcrypt.hash(password, 10),
    ]);

    if (!invitation) {
      logger.warn("Invalid or expired invitation token", ctx);
      return error(
        "INVALID_OR_EXPIRED_TOKEN",
        "This invitation link has expired, been used, or been revoked. Please ask for a new one.",
        400
      );
    }

    // Step 4: Look up any existing user with this email. Email is globally
    // unique, so we have to handle three cases:
    //   (a) no row at all          → create a fresh user (default path)
    //   (b) row exists, NOT soft-deleted → block, the email is in active use
    //   (c) row exists, soft-deleted     → restore it onto the inviting org +
    //                                      role with the new password. The
    //                                      old user identity (id, history,
    //                                      audit trail) is preserved.
    //
    // Old Author: Puran
    // New Author: Puran
    // Impact: soft-deleted users can now accept a fresh invite (case c)
    // Reason: previously case (b) and (c) were collapsed into a single
    //         EMAIL_ALREADY_REGISTERED block, so an admin who removed a
    //         teammate and then re-invited them was hitting a dead end.
    //         The restore path keeps the original user.id (so audit logs
    //         and any historical references stay valid) but flips
    //         deletedAt back to null and re-attaches to the org/role from
    //         the invitation.
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, deletedAt: true },
    });

    if (existingUser && existingUser.deletedAt === null) {
      logger.info("Accept invitation blocked — email already registered", {
        ...ctx,
        invitationId: invitation.id,
      });
      return error(
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists. Please log in instead.",
        409
      );
    }

    const restoringSoftDeleted =
      existingUser !== null && existingUser.deletedAt !== null;

    // Resolve identity fields. The invitation is the source of truth: if
    // the admin entered firstName/lastName/jobTitle when inviting, we
    // use those (the invitee can't retype their own name to something
    // different). If the invitation predates the migration (legacy data,
    // null fields), fall back to splitting the form's fullName on the
    // first space. fullName itself is always derived from first + last
    // when we have them, so it stays in sync.
    const firstName = invitation.firstName ?? fullName.trim().split(/\s+/)[0] ?? "";
    const lastName =
      invitation.lastName ??
      fullName.trim().split(/\s+/).slice(1).join(" ") ??
      "";
    const jobTitle = invitation.jobTitle ?? null;
    const composedFullName =
      invitation.firstName && invitation.lastName
        ? `${invitation.firstName} ${invitation.lastName}`
        : fullName;

    // Step 5: Create OR restore the user, then consume the invitation
    // atomically. Invited users land as STAFF (system role); the org-level
    // OrganizationRole drives module access. Admins can promote to
    // MANAGER/ADMIN later via the edit page. We mark isVerified: true
    // because the invitation email itself proves ownership of the address —
    // no second OTP round-trip needed.
    //
    // Restore path: when the existing user is soft-deleted we re-use the
    // same row (preserving its id and history) and overwrite identity +
    // password + org/role fields. We do NOT touch the historical
    // createdAt — that stays as the original signup date.
    const userSelect = {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      email: true,
      role: true,
      isVerified: true,
      orgId: true,
      organizationRoleId: true,
      createdAt: true,
    } as const;

    let createdUser;
    try {
      const [newUser] = await db.$transaction([
        restoringSoftDeleted
          ? db.user.update({
              where: { email: invitation.email },
              data: {
                fullName: composedFullName,
                firstName,
                lastName,
                jobTitle,
                passwordHash,
                role: "STAFF",
                isVerified: true,
                orgId: invitation.orgId,
                organizationRoleId: invitation.organizationRoleId,
                deletedAt: null,
              },
              select: userSelect,
            })
          : db.user.create({
              data: {
                fullName: composedFullName,
                firstName,
                lastName,
                jobTitle,
                email: invitation.email,
                passwordHash,
                role: "STAFF",
                isVerified: true,
                orgId: invitation.orgId,
                organizationRoleId: invitation.organizationRoleId,
              },
              select: userSelect,
            }),
        db.invitation.update({
          where: { id: invitation.id },
          data: { consumedAt: new Date() },
        }),
      ]);
      createdUser = newUser;
    } catch (txErr) {
      // P2002 on email column — another request already created the user
      // with this email in the narrow window between our lookup and insert.
      // Map it to the stable error code instead of leaking Prisma details.
      if (
        txErr instanceof Prisma.PrismaClientKnownRequestError &&
        txErr.code === "P2002"
      ) {
        logger.warn("Accept invitation race — email already registered", {
          ...ctx,
          invitationId: invitation.id,
        });
        return error(
          "EMAIL_ALREADY_REGISTERED",
          "An account with this email already exists. Please log in instead.",
          409
        );
      }
      throw txErr;
    }

    // Step 6: Create session + set cookie — user is logged in immediately.
    // Session creation failing after user creation is rare; if it happens the
    // user can still log in manually, so we log and return a 500 rather than
    // trying to roll back the user row.
    const { token: sessionToken, expiresAt: sessionExpiresAt } =
      await createSession(createdUser.id);

    logger.info("Invitation accepted", {
      ...ctx,
      userId: createdUser.id,
      orgId: createdUser.orgId,
      invitationId: invitation.id,
      restored: restoringSoftDeleted,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: createdUser,
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookieHeader(sessionToken, sessionExpiresAt),
        },
      }
    );
  } catch (err) {
    logger.error("Accept invitation failed", ctx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while accepting your invitation. Please try again.",
      500
    );
  }
}
