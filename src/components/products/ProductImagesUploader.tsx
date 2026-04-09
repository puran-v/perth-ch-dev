"use client";

/**
 * ProductImagesUploader — multi-image picker for the Product editor's
 * Basic Info tab. Mirrors the pattern used by `LogoUploader` in
 * `BrandingForm.tsx`: each file is read with FileReader and stored as a
 * base64 data URL string. The parent owns the array; this component
 * just emits the next state via `onChange`.
 *
 * No object storage is wired in V1 — Branding does the same thing.
 * When real storage (S3 / R2) lands, both components migrate together
 * and the API contract (still `string[]`) doesn't change.
 *
 * Limits enforced client-side AND server-side (Zod):
 *   - up to 10 images per product
 *   - 2 MB per image (raw file size)
 *   - PNG / JPG / WebP only — no SVG (XSS surface) or GIF (bloated)
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */

// Author: Puran
// Impact: replaces the placeholder grey-square grid in ProductEditorForm
//         with a real upload + preview + remove flow
// Reason: client confirmed images should follow the existing branding
//         pattern (FileReader → data URL → text[] in Postgres) so we
//         don't introduce a second upload mechanism before storage lands

import { useCallback, useRef, useState } from "react";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
/** Raw file size cap. Mirrors the Zod schema (2 MB → ~2.67 MB base64). */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Hard cap on how many images a single product can carry. */
const IMAGE_MAX_COUNT = 10;

interface ProductImagesUploaderProps {
  /** Current image list as base64 data URLs, in display order. */
  value: string[];
  /** Emits the next array — parent stores it in form state. */
  onChange: (next: string[]) => void;
}

/**
 * Click + drag-drop multi-image uploader. Reads each file as a base64
 * data URL via FileReader and appends it to the parent's `value` array.
 *
 * Show-stopping rules (rejections show inline below the grid):
 *   - file is not an allowed image type
 *   - file exceeds 2 MB
 *   - the array is already at 10 images
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
export function ProductImagesUploader({
  value,
  onChange,
}: ProductImagesUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remainingSlots = IMAGE_MAX_COUNT - value.length;
  const atCapacity = remainingSlots <= 0;

  /**
   * Reads a batch of files into base64 data URLs in parallel and appends
   * the successful ones to the existing array. Stops at the 10-image cap.
   * Rejected files surface a single inline error rather than spamming
   * the toast queue with one per file.
   */
  const readFiles = useCallback(
    (files: FileList | File[]) => {
      setLocalError(null);

      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      if (atCapacity) {
        setLocalError(`You can only upload up to ${IMAGE_MAX_COUNT} images.`);
        return;
      }

      // Author: Puran
      // Impact: silently truncate the batch to the remaining slot count
      //         instead of rejecting the whole drop
      // Reason: dragging 15 images onto a product that already has 7
      //         should add 3 (filling to 10) and warn — not reject the
      //         whole batch and force the user to re-drag a smaller set
      const accepted = incoming.slice(0, remainingSlots);
      const truncated = incoming.length > accepted.length;

      const reasons: string[] = [];
      if (truncated) {
        reasons.push(
          `Only ${remainingSlots} more image${
            remainingSlots === 1 ? "" : "s"
          } can be added.`
        );
      }

      const validations: { file: File; error?: string }[] = accepted.map(
        (file) => {
          if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
            return { file, error: `${file.name}: must be PNG, JPG, or WebP` };
          }
          if (file.size > IMAGE_MAX_BYTES) {
            return { file, error: `${file.name}: must be 2 MB or less` };
          }
          return { file };
        }
      );

      const validFiles = validations
        .filter((v) => !v.error)
        .map((v) => v.file);
      const errorFiles = validations.filter((v) => v.error);
      errorFiles.forEach((v) => v.error && reasons.push(v.error));

      if (validFiles.length === 0) {
        setLocalError(reasons.join(" "));
        return;
      }

      // Read every accepted file in parallel — Promise.all preserves the
      // original order so the user's drop order matches the display order.
      Promise.all(
        validFiles.map(
          (file) =>
            new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve(typeof reader.result === "string" ? reader.result : null);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            })
        )
      ).then((results) => {
        const dataUrls = results.filter((r): r is string => r !== null);
        if (dataUrls.length > 0) {
          onChange([...value, ...dataUrls]);
        }
        if (reasons.length > 0) {
          setLocalError(reasons.join(" "));
        }
      });
    },
    [atCapacity, onChange, remainingSlots, value]
  );

  const handlePick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) readFiles(e.target.files);
    // Reset so picking the same file twice still fires onChange.
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!atCapacity) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) readFiles(e.dataTransfer.files);
  };

  const handleRemove = (index: number) => {
    setLocalError(null);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload product images"
      />

      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "rounded-2xl transition-colors",
          dragActive ? "bg-[#1a2f6e]/5 ring-2 ring-[#1a2f6e]/30" : "",
        ].join(" ")}
      >
        {/* Author: Puran */}
        {/* Impact: tiles are now Figma-spec fixed 232×232 squares laid */}
        {/*         out in a flex-wrap row instead of a stretchy grid */}
        {/* Reason: Figma calls for fixed 232×232 px tiles regardless of */}
        {/*         card width. flex-wrap gives us "as many tiles as fit */}
        {/*         per row" without the grid forcing each cell to share */}
        {/*         the available width equally. On desktop you'll see */}
        {/*         4-5 tiles per row at 232px; on tablet 2-3; on mobile */}
        {/*         the tiles cap at the card width via max-w-full so */}
        {/*         they stay one-per-row instead of overflowing. */}
        <div className="flex flex-wrap gap-4">
          {value.map((dataUrl, idx) => (
            <div
              key={idx}
              className="group relative h-58 w-58 max-w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`Product image ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                  Primary
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Remove image ${idx + 1}`}
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition-colors hover:bg-white hover:text-red-600"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          {!atCapacity && (
            // Author: Puran
            // Impact: solid slate-50 fill, no border, no label —
            //         just a centered + icon
            // Reason: matches the Figma exactly. The dashed border
            //         + "Add image" label fought the rest of the
            //         editor visually; the clean solid tile reads
            //         as "another slot, click to fill" without any
            //         extra chrome. Hover deepens the bg slightly
            //         so it still feels interactive.
            <button
              type="button"
              onClick={handlePick}
              aria-label="Add product image"
              className="h-58 w-58 max-w-full rounded-2xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          PNG, JPG, or WebP · Max 2 MB each · Up to {IMAGE_MAX_COUNT} images
        </p>
        <p className="text-xs text-slate-400">
          {value.length} / {IMAGE_MAX_COUNT}
        </p>
      </div>

      {localError && (
        <p className="mt-1.5 text-xs text-red-500">{localError}</p>
      )}
    </div>
  );
}
