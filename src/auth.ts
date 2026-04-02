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


  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * Auto-provision: creates a new User if no account exists for the
     * verified email. Links the OAuth Account row on every sign-in.
     * OAuth email is treated as verified since the provider asserts it.
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
        logger.warn("OAuth sign-in rejected: email not verified by provider", {
          route: "/api/auth/callback",
          provider: account.provider,
        });
        return "/login?error=EmailNotVerified";
      }

      // Find existing user or auto-create one
      let existingUser = await db.user.findUnique({
        where: { email, deletedAt: null },
      });

      if (!existingUser) {
        // Auto-provision: create user from OAuth profile
        const fullName = user.name || profile?.name || email.split("@")[0];
        existingUser = await db.user.create({
          data: {
            fullName: String(fullName),
            email,
            // passwordHash is null — OAuth-only account
            role: "ADMIN",
            isVerified: true, // OAuth email is provider-verified
          },
        });

        logger.info("OAuth auto-provisioned new user", {
          route: "/api/auth/callback",
          provider: account.provider,
          userId: existingUser.id,
        });
      }

      // Upsert Account link row
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
          idToken: account.id_token ?? null,
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
          idToken: account.id_token ?? null,
        },
      });

      // Mark user as verified if not already (OAuth email is provider-verified)
      if (!existingUser.isVerified) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { isVerified: true },
        });
      }

      logger.info("OAuth sign-in allowed", {
        route: "/api/auth/callback",
        provider: account.provider,
        userId: existingUser.id,
      });

      return true;
    },

    /**
     * Puts our Prisma user ID into the JWT so the bridge can read it.
     *
     * @author Puran
     * @created 2026-04-02
     * @module Auth - OAuth
     */
    async jwt({ token, user, account }) {
      if (account && user?.email) {
        const email = user.email.toLowerCase().trim();
        const dbUser = await db.user.findUnique({
          where: { email, deletedAt: null },
          select: { id: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
        }
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
