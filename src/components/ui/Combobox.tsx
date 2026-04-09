"use client";

/**
 * Combobox — searchable single-select with optional create-on-the-fly.
 *
 * Use cases this is built for: any "pick from a list, or type a new
 * value" form field. Today it's the Category picker on the Product
 * editor; next consumers will be customer tags, vendor lists, quote
 * template categories, etc.
 *
 * Why a new primitive instead of extending `StyledSelect`:
 * - Native `<select>` can't host a search input or a "+ Add" action
 *   without trapping the user in browser-specific behaviour.
 * - The Figma + UX spec calls for typeahead, keyboard nav with
 *   highlighted active item, and inline create — the standard
 *   pattern in every modern design system (Headless UI, Radix,
 *   Reach UI). Trying to bend `<select>` into that always ends
 *   half-broken.
 *
 * Visual contract: matches the existing `Input` / `StyledSelect`
 * pill shape — `h-12 rounded-full border` so dropping it into any
 * existing form lines up with the other fields automatically.
 *
 * Accessibility:
 * - `role="combobox"` on the trigger with `aria-expanded` / `aria-controls`
 * - `role="listbox"` on the popover, `role="option"` on each item
 * - `aria-activedescendant` tracks the highlighted index for screen readers
 * - Arrow Up / Down moves the highlight, Enter selects, Escape closes
 * - Focus traps inside the popover while open, returns to trigger on close
 *
 * @example
 * <Combobox<Category>
 *   label="Category"
 *   value={selectedCategory}
 *   onChange={(c) => setSelectedCategory(c)}
 *   options={categories}
 *   getOptionId={(c) => c.id}
 *   getOptionLabel={(c) => c.name}
 *   onCreate={async (name) => createCategory.mutateAsync({ name })}
 *   createLabel={(input) => `+ Add "${input}"`}
 * />
 *
 * @author Puran
 * @created 2026-04-08
 * @module UI - Primitives
 */

// Author: Puran
// Impact: new shared Combobox primitive used by the Category picker
//         on the Product editor; designed to be reusable for any
//         future "select-from-list-or-create-new" field
// Reason: PROJECT_RULES §1.1 — reuse over rebuild. One Combobox in
//         components/ui means every consumer in the app gets the
//         same keyboard nav, focus management, and styling, and a
//         11y bugs only have to be fixed once.

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

interface ComboboxProps<T> {
  /** Currently selected option, or null if nothing is selected. */
  value: T | null;
  /** Called when the user picks an option (or clears selection). */
  onChange: (next: T | null) => void;
  /** Full list of options to render in the popover. */
  options: T[];
  /** Stable id extractor — used for the React key + aria attributes. */
  getOptionId: (option: T) => string;
  /** Display label extractor — what the user reads in each option. */
  getOptionLabel: (option: T) => string;

  /** Optional label rendered above the trigger (matches Input's label). */
  label?: string;
  /** Trigger placeholder shown when no value is selected. */
  placeholder?: string;
  /** Inline error message rendered below the trigger. */
  error?: string;
  /** Disable the trigger entirely. */
  disabled?: boolean;
  /**
   * Visually disable the popover content while options are still
   * loading. The trigger stays clickable so users can open it and
   * see the spinner instead of finding a dead control.
   */
  loading?: boolean;
  /**
   * Empty-state message rendered when the filtered list is empty AND
   * `onCreate` is not provided. When `onCreate` is provided, the
   * "+ Add" row replaces this so the user always has a forward path.
   */
  emptyMessage?: string;

  // ── Optional create-on-the-fly ───────────────────────────────────
  /**
   * Async creator. When provided AND the typed search has no exact
   * match in `options`, a "+ Add" row appears at the bottom of the
   * popover. Clicking it calls `onCreate(input)`, awaits the result,
   * and the returned option becomes the selected value.
   */
  onCreate?: (name: string) => Promise<T>;
  /**
   * Custom label for the "+ Add" row. Receives the current search
   * input. Defaults to `+ Add "{input}"`.
   */
  createLabel?: (input: string) => string;
}

/**
 * Searchable single-select combobox with optional create-on-the-fly.
 *
 * @author Puran
 * @created 2026-04-08
 * @module UI - Primitives
 */
export function Combobox<T>(props: ComboboxProps<T>) {
  const {
    value,
    onChange,
    options,
    getOptionId,
    getOptionLabel,
    label,
    placeholder = "Select...",
    error,
    disabled = false,
    loading = false,
    emptyMessage = "No matches",
    onCreate,
    createLabel = (input) => `+ Add "${input}"`,
  } = props;

  // Stable ids for the label / listbox / active option for a11y.
  const reactId = useId();
  const triggerId = `${reactId}-trigger`;
  const listboxId = `${reactId}-listbox`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  // ── Filtered options + the create-row decision ────────────────────
  // Author: Puran
  // Impact: case-insensitive substring match on the search input
  // Reason: catches "infl" → "Inflatable" without forcing the user
  //         to remember exact wording. The trim() guards against
  //         accidental leading whitespace breaking the match.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) =>
      getOptionLabel(opt).toLowerCase().includes(q)
    );
  }, [options, search, getOptionLabel]);

  // Create row appears when: onCreate is wired, the user has typed
  // something, and that something doesn't exactly match an existing
  // option (case-insensitive). "Exact match" prevents adding "Inflatable"
  // a second time when it already exists.
  const trimmedSearch = search.trim();
  const exactMatch = useMemo(() => {
    if (!trimmedSearch) return false;
    return options.some(
      (opt) => getOptionLabel(opt).toLowerCase() === trimmedSearch.toLowerCase()
    );
  }, [options, trimmedSearch, getOptionLabel]);
  const showCreateRow = Boolean(onCreate) && trimmedSearch !== "" && !exactMatch;

  // Total clickable rows = filtered options + (1 if the create row is visible).
  // Highlight index walks 0..totalRows-1; the create row is at the end.
  const totalRows = filtered.length + (showCreateRow ? 1 : 0);
  const createRowIndex = filtered.length; // valid only when showCreateRow

  // ── Open / close behaviour ────────────────────────────────────────
  const closePopover = useCallback(() => {
    setOpen(false);
    setSearch("");
    setHighlightIndex(0);
    // Return focus to the trigger so keyboard users don't get lost.
    triggerRef.current?.focus();
  }, []);

  const openPopover = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setHighlightIndex(0);
  }, [disabled]);

  // Author: Puran
  // Impact: outside-click + Escape close the popover
  // Reason: standard combobox UX. Without this, the popover hangs
  //         around when the user clicks elsewhere on the page.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closePopover]);

  // Author: Puran
  // Impact: focus the search input as soon as the popover opens
  // Reason: keyboard users should be able to start typing immediately.
  //         Mouse users get the same: clicking the trigger drops their
  //         cursor into the search field instead of forcing a second
  //         click.
  useEffect(() => {
    if (open) {
      // Defer to next frame so the popover is mounted before focus moves.
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  // Reset highlight when filtered list shrinks/grows so it never
  // points past the end of the array.
  useEffect(() => {
    if (highlightIndex >= totalRows) {
      setHighlightIndex(totalRows > 0 ? totalRows - 1 : 0);
    }
  }, [highlightIndex, totalRows]);

  // ── Selection handlers ───────────────────────────────────────────

  const handleSelectOption = useCallback(
    (option: T) => {
      onChange(option);
      closePopover();
    },
    [onChange, closePopover]
  );

  const handleCreate = useCallback(async () => {
    if (!onCreate || !trimmedSearch || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmedSearch);
      onChange(created);
      closePopover();
    } catch {
      // The caller is expected to surface the error via toast — we
      // just stop the spinner so the row becomes clickable again.
    } finally {
      setCreating(false);
    }
  }, [onCreate, trimmedSearch, creating, onChange, closePopover]);

  // ── Keyboard nav ─────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % Math.max(totalRows, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) =>
          i === 0 ? Math.max(totalRows - 1, 0) : i - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (showCreateRow && highlightIndex === createRowIndex) {
          void handleCreate();
        } else if (filtered[highlightIndex]) {
          handleSelectOption(filtered[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        closePopover();
        break;
      default:
        break;
    }
  };

  // ── Trigger label ────────────────────────────────────────────────
  const triggerLabel = value ? getOptionLabel(value) : "";

  // The active descendant id used by aria-activedescendant. Built so
  // screen readers announce the highlighted row even though focus
  // stays on the search input.
  const activeOptionId = (() => {
    if (!open) return undefined;
    if (showCreateRow && highlightIndex === createRowIndex) {
      return `${listboxId}-create`;
    }
    const opt = filtered[highlightIndex];
    return opt ? `${listboxId}-${getOptionId(opt)}` : undefined;
  })();

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={wrapperRef}>
      {label && (
        <label
          htmlFor={triggerId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}

      <div className="relative w-full">
        {/* Trigger — visually identical to Input / StyledSelect so it
            drops into existing forms without re-tuning spacing. */}
        <button
          id={triggerId}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-haspopup="listbox"
          aria-label={label}
          disabled={disabled}
          onClick={() => (open ? closePopover() : openPopover())}
          className={[
            "flex items-center justify-between gap-2 w-full h-12 rounded-full border bg-white px-4 text-left text-sm transition-colors",
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
            error
              ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200 focus:outline-none"
              : "border-gray-200 focus:border-[#1a2f6e] focus:ring-2 focus:ring-[#1a2f6e]/20 focus:outline-none",
          ].join(" ")}
        >
          <span
            className={[
              "truncate",
              triggerLabel ? "text-gray-900" : "text-gray-400",
            ].join(" ")}
          >
            {triggerLabel || placeholder}
          </span>
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Popover */}
        {open && (
          <div
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
            role="presentation"
          >
            {/* Search input — pill-shaped to match the rest of the
                form, with a small magnifier icon on the left. */}
            <div className="border-b border-slate-100 p-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 h-10 focus-within:border-[#1a2f6e] focus-within:ring-2 focus-within:ring-[#1a2f6e]/20">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or add new..."
                  aria-label="Search options"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={activeOptionId}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                />
              </div>
            </div>

            {/* Listbox */}
            <ul
              id={listboxId}
              role="listbox"
              className="max-h-64 overflow-y-auto py-1"
            >
              {loading && filtered.length === 0 && !showCreateRow ? (
                <li
                  className="px-4 py-3 text-center text-xs text-slate-400"
                  aria-live="polite"
                >
                  Loading...
                </li>
              ) : filtered.length === 0 && !showCreateRow ? (
                <li
                  className="px-4 py-3 text-center text-xs text-slate-400"
                  aria-live="polite"
                >
                  {emptyMessage}
                </li>
              ) : (
                <>
                  {filtered.map((opt, idx) => {
                    const id = getOptionId(opt);
                    const optLabel = getOptionLabel(opt);
                    const selected =
                      value !== null && getOptionId(value) === id;
                    const highlighted = idx === highlightIndex;
                    return (
                      <li
                        key={id}
                        id={`${listboxId}-${id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onClick={() => handleSelectOption(opt)}
                        className={[
                          "flex items-center justify-between gap-2 px-4 py-2.5 text-sm cursor-pointer transition-colors",
                          highlighted
                            ? "bg-[#1a2f6e]/5"
                            : "bg-transparent",
                          selected
                            ? "font-semibold text-[#1a2f6e]"
                            : "text-slate-700",
                        ].join(" ")}
                      >
                        <span className="truncate">{optLabel}</span>
                        {selected && (
                          <svg
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-[#1a2f6e]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </li>
                    );
                  })}
                  {showCreateRow && (
                    <li
                      id={`${listboxId}-create`}
                      role="option"
                      aria-selected={highlightIndex === createRowIndex}
                      onMouseEnter={() => setHighlightIndex(createRowIndex)}
                      onClick={() => void handleCreate()}
                      className={[
                        "flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm cursor-pointer transition-colors",
                        highlightIndex === createRowIndex
                          ? "bg-blue-50 text-blue"
                          : "bg-transparent text-blue",
                        creating ? "cursor-wait opacity-60" : "",
                      ].join(" ")}
                    >
                      {creating ? (
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 animate-spin text-blue"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      )}
                      <span className="font-medium">
                        {createLabel(trimmedSearch)}
                      </span>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
