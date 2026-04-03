/**
 * Auth.js v5 configuration — used ONLY for OAuth (Google + Microsoft).
 *
 * Email/password login stays on our custom POST /api/auth/login route.
 * After OAuth, the signIn callback auto-provisions new users if no account
 * exists for the verified email, and the redirect callback routes to our
 * bridge endpoint which creates our app session_token cookie.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth
 */

// Author: Puran
// Impact: adds Google + Microsoft OAuth via Auth.js v5
// Reason: social login requirement — bridge to existing session_token system

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET,
      // Single-tenant: issuer includes the tenant ID to restrict login to one org
      issuer: process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID}/v2.0`
        : undefined,
    }),
  ],

  // Use JWT strategy for Auth.js internal session (short-lived, only for OAuth callback)
  session: { strategy: "jwt", maxAge: 5 * 60 },

  secret: process.env.AUTH_SECRET,

  // Route all Auth.js internal logs through our structured logger
  logger: {
    error(error) {
      logger.error("Auth.js error", { route: "/api/auth" }, error);
    },
    warn(code) {
      logger.warn(`Auth.js warning: ${code}`, { route: "/api/auth" });
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * Auto-provision: finds or creates a User for the verified email,
     * links the OAuth Account row, and stores the Prisma userId on the
     * Auth.js user object so the jwt callback can read it without
     * a second DB query.
     *
     * Uses transaction + P2002 handling to prevent race conditions
     * when two concurrent OAuth requests arrive with the same email.
     *
     * Rejects soft-deleted users explicitly (§5.3).
     *
     * @author Puran
     * @created 2026-04-02
     * @module Auth - OAuth
     */
    async signIn({ user, account, profile }) {
      if (!account || !user.email) return "/login?error=OAuthFailed";

      const email = user.email.toLowerCase().trim();

      // Require verified email from provider
      // Google sends email_verified explicitly; Microsoft Entra ID emails
      // are implicitly verified (they come from the tenant directory)
      const isMicrosoft = account.provider === "microsoft-entra-id";
      const emailVerified = isMicrosoft || Boolean(profile?.email_verified);
      if (!emailVerified) {
        logger.warn("OAuth rejected: email not verified by provider", {
          route: "/api/auth/callback",
          provider: account.provider,
        });
        return "/login?error=EmailNotVerified";
      }

      try {
        // Check for soft-deleted user first — prevent account resurrection (§5.3)
        const anyUser = await db.user.findUnique({ where: { email } });
        if (anyUser?.deletedAt) {
          logger.warn("OAuth rejected: soft-deleted user attempted login", {
            route: "/api/auth/callback",
            provider: account.provider,
            userId: anyUser.id,
          });
          return "/login?error=AccountDeleted";
        }

        // Find or create user in a transaction to prevent race conditions
        // If two concurrent requests try to create the same user, the second
        // one catches P2002 (unique constraint) and looks up the existing row
        const existingUser = await db.$transaction(async (tx) => {
          let dbUser = await tx.user.findUnique({
            where: { email, deletedAt: null },
          });

          if (!dbUser) {
            const fullName = user.name || profile?.name || email.split("@")[0];
            try {
              dbUser = await tx.user.create({
                data: {
                  fullName: String(fullName),
                  email,
                  role: "ADMIN",
                  isVerified: true,
                },
              });

              logger.info("OAuth auto-provisioned new user", {
                route: "/api/auth/callback",
                provider: account.provider,
                userId: dbUser.id,
              });
            } catch (createErr: unknown) {
              // P2002 = unique constraint violation — another request created this user
              const isPrismaUniqueError =
                createErr !== null &&
                typeof createErr === "object" &&
                "code" in createErr &&
                (createErr as { code: string }).code === "P2002";

              if (isPrismaUniqueError) {
                dbUser = await tx.user.findUniqueOrThrow({
                  where: { email, deletedAt: null },
                });
              } else {
                throw createErr;
              }
            }
          }

          return dbUser;
        });

        // Upsert Account link row
        // Don't store idToken — can be very large (>2KB) and not needed after callback
        await db.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
            tokenType: account.token_type ?? null,
            scope: account.scope ?? null,
          },
          create: {
            userId: existingUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type ?? "oauth",
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
            tokenType: account.token_type ?? null,
            scope: account.scope ?? null,
          },
        });

        // Mark user as verified if not already (OAuth email is provider-verified)
        if (!existingUser.isVerified) {
          await db.user.update({
            where: { id: existingUser.id },
            data: { isVerified: true },
          });
        }

        // Store userId on the Auth.js user object so jwt callback can read it
        // without a separate DB query (eliminates redundant lookup)
        user.id = existingUser.id;

        logger.info("OAuth sign-in allowed", {
          route: "/api/auth/callback",
          provider: account.provider,
          userId: existingUser.id,
        });

        return true;
      } catch (err) {
        logger.error("OAuth sign-in DB error", {
          route: "/api/auth/callback",
          provider: account.provider,
        }, err);
        return "/login?error=OAuthFailed";
      }
    },

    /**
     * Reads the Prisma userId from the Auth.js user object (set by signIn
     * callback) and stores it in the JWT. No additional DB query needed.
     *
     * @author Puran
     * @created 2026-04-02
     * @module Auth - OAuth
     */
    async jwt({ token, user, account }) {
      // On initial sign-in, user.id is set by our signIn callback to the Prisma cuid
      if (account && user?.id) {
        token.userId = user.id;
      }
      return token;
    },

    /**
     * Expose userId on the session object for the bridge route.
     *
     * @author Puran
     * @created 2026-04-02
     * @module Auth - OAuth
     */
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
