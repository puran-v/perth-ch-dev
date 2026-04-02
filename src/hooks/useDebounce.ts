"use client";

/**
 * Debounce hook for delaying value updates.
 *
 * Commonly used with search inputs to avoid firing API requests
 * on every keystroke. The debounced value only updates after the
 * user stops typing for the specified delay.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * // use debouncedSearch in your query key
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Hooks
 */

// Author: samir
// Impact: new reusable debounce hook
// Reason: PROJECT_RULES.md §1.1 requires shared hooks for common patterns

import { useState, useEffect } from "react";

/**
 * Returns a debounced version of the provided value.
 * The returned value only updates after the specified delay
 * has passed since the last change.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Hooks
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
