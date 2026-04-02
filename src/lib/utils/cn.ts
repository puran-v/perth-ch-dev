/**
 * ClassName merge utility combining clsx and tailwind-merge.
 *
 * Use this everywhere instead of manual string concatenation for
 * className props. Handles conditional classes, arrays, and resolves
 * Tailwind CSS conflicts (e.g. 'px-4 px-6' → 'px-6').
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */

// Author: samir
// Impact: new className merge utility for the entire project
// Reason: PROJECT_RULES.md §1.1 requires shared utilities for common patterns

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution.
 *
 * @param inputs - Class values (strings, arrays, conditionals)
 * @returns Merged and deduplicated className string
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
