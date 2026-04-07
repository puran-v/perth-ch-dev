/**
 * Zod validation schemas for Team & Users API routes.
 *
 * Covers OrganizationRole CRUD and Invitation bulk create + actions.
 * Per PROJECT_RULES §4.6: every API route MUST validate input with Zod.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Validation
 */

// Author: Puran
// Impact: Zod schemas for roles, invitations, and member updates
// Reason: §4.6 non-negotiable input validation before business logic

import { z } from "zod";

// ── Shared field schemas ─────────────────────────────────────────────

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format")
  .max(254, "Email must be 254 characters or less");

const cuidField = z.string().cuid("Invalid ID format");

// ── OrganizationRole schemas ─────────────────────────────────────────

/**
 * Create or update an OrganizationRole.
 * Name is unique per org (DB constraint).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Validation
 */
export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Role name is required")
    .max(80, "Role name must be 80 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  moduleA: z.boolean().optional(),
  moduleB: z.boolean().optional(),
  moduleC: z.boolean().optional(),
  moduleD: z.boolean().optional(),
  moduleE: z.boolean().optional(),
});

/**
 * Bulk reorder roles. Body is array of { id, sortOrder } pairs.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Validation
 */
export const reorderRolesSchema = z.object({
  order: z
    .array(
      z.object({
        id: cuidField,
        sortOrder: z.number().int().min(0).max(9999),
      })
    )
    .min(1, "At least one role is required"),
});

// ── Invitation schemas ───────────────────────────────────────────────

/**
 * Bulk invitation creation. Each row carries identity + role; optional
 * shared personalMessage applies to all invites in the batch.
 *
 * firstName + lastName are required so the invitation email can greet
 * the recipient properly and the future User row has real name data
 * from the start. jobTitle is optional — many teams don't use formal
 * titles and we don't want to force one.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Validation
 */
// Old Author: Puran
// New Author: Puran
// Impact: personalMessage moved from top-level (shared across batch) to
//         per-invite so each invitee can receive their own custom note
// Reason: admins were sending one note that ended up on every email in
//         the batch, which made the message generic/awkward. Per-invite
//         messages let the admin write something tailored ("Hi Bob, you'll
//         be running the Saturday shift") without affecting other rows.
export const bulkInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        firstName: z
          .string()
          .trim()
          .min(1, "First name is required")
          .max(80, "First name must be 80 characters or less"),
        lastName: z
          .string()
          .trim()
          .min(1, "Last name is required")
          .max(80, "Last name must be 80 characters or less"),
        jobTitle: z
          .string()
          .trim()
          .max(120, "Job title must be 120 characters or less")
          .optional()
          .nullable(),
        email: emailField,
        organizationRoleId: cuidField,
        personalMessage: z
          .string()
          .trim()
          .max(1000, "Personal message must be 1000 characters or less")
          .optional()
          .nullable(),
      })
    )
    .min(1, "At least one invite is required")
    .max(50, "Maximum 50 invites per batch"),
});

// ── Member update schema ─────────────────────────────────────────────

/**
 * Update a member — V1 only allows role change.
 * Email is stable (users change it via profile settings in V2).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Validation
 */
export const updateMemberSchema = z.object({
  organizationRoleId: cuidField,
});

// ── Inferred types ───────────────────────────────────────────────────

export type RoleInput = z.infer<typeof roleSchema>;
export type ReorderRolesInput = z.infer<typeof reorderRolesSchema>;
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
