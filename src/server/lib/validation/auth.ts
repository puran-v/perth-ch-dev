/**
 * Zod validation schemas for all authentication API endpoints.
 *
 * Every API route MUST validate input using these schemas before
 * executing any business logic (PROJECT_RULES.md §4.6).
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Validation
 */

// Old Author: jay
// New Author: samir
// Impact: added file-level JSDoc and schema-level JSDoc annotations
// Reason: align with PROJECT_RULES.md §4.2 function documentation requirement

import { z } from "zod";

/** Validates signup request body: fullName, email, password with strength rules */
export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or less"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or less")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit"),
});

/** Validates verify-email request body: email + 6-digit OTP code */
export const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
  code: z
    .string()
    .trim()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only digits"),
});

/** Validates resend-verification request body: email only */
export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must be 128 characters or less"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
});

export const resetPasswordSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or less")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit"),
});

// Author: Puran
// Impact: validation for POST /api/auth/accept-invitation
// Reason: mirror signup rules so invited users meet the same password standard

/** Validates accept-invitation body: token + full name + password (signup-strength) */
export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Token is required"),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be 120 characters or less"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or less")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
