'use client';

// Author: samir
// Impact: new form component for Module A step 2 (Branding)
// Reason: /dashboard/branding needs to capture logo, brand colours, and email sender identity, then hand the data off to the shared /api/org-setup endpoint via the same forwardRef + validate()/getFormData() pattern as the other org-setup forms

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { Card } from '../ui/Card';
import Input from '../ui/Input';
import {
  brandingSchema,
  type BrandingInput,
} from '@/lib/validation/org-setup';

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

export interface BrandingFormData {
  /**
   * Base64 data URL of the uploaded logo — placeholder until real object
   * storage is wired up. Cleared to an empty string when the user removes
   * the logo. Capped at ~2 MB by the Zod schema.
   */
  logoDataUrl: string;
  primaryColor: string;
  accentColor: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

/** Imperative handle exposed to the parent via ref. */
export interface BrandingFormHandle {
  validate: () => BrandingInput | null;
  getFormData: () => BrandingFormData;
}

interface BrandingFormProps {
  initialData?: Partial<BrandingFormData>;
  saved?: boolean;
  className?: string;
}

/** Empty defaults — user picks their own colours and types their own emails. */
const INITIAL_FORM_STATE: BrandingFormData = {
  logoDataUrl: '',
  primaryColor: '#1A3C6E',
  accentColor: '#2563EB',
  fromName: '',
  fromEmail: '',
  replyTo: '',
};

const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif';
// Hard cap mirrors the Zod schema (2 MB file → ~2.67 MB base64).
// We check the RAW file size (before base64 expansion) against 2 MB so
// the UI message matches the help text "Max 2 MB".
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Inline icons (kept local to avoid growing the shared icon set)
// ---------------------------------------------------------------------------

function UploadIcon() {
  // Old Author: samir
  // New Author: samir
  // Impact: arrow now points DOWN into the tray, matching the Figma drop-zone style
  // Reason: image design shows the canonical "download to here" arrow (arrow-down-tray) — even though the label is "Upload", the iconography indicates "drop your file here"
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 8V20M16 20L10 14M16 20L22 14"
        stroke="#042E93"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 22V24C6 25.1046 6.89543 26 8 26H24C25.1046 26 26 25.1046 26 24V22"
        stroke="#042E93"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="#3B82F6" strokeWidth="1.5" />
      <path d="M10 9V14" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="#3B82F6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Logo uploader sub-component
// ---------------------------------------------------------------------------

interface LogoUploaderProps {
  value: string;
  onChange: (dataUrl: string) => void;
  error?: string;
}

/**
 * Clickable + drag-drop logo upload zone. Reads the selected file as a
 * base64 data URL for both preview and persistence — this is a
 * placeholder until a real object-storage upload (S3 / R2 / similar) is
 * wired up. Files over the 2 MB cap are rejected with an inline error.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Branding
 */
function LogoUploader({ value, onChange, error }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const readFile = useCallback(
    (file: File) => {
      setLocalError(null);

      if (!file.type.startsWith('image/')) {
        setLocalError('Logo must be an image file');
        return;
      }
      if (file.size > LOGO_MAX_BYTES) {
        setLocalError('Logo must be 2 MB or less');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        onChange(result);
      };
      reader.onerror = () => {
        setLocalError('Could not read the selected file');
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handlePick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    // Reset so selecting the same file twice still fires onChange.
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
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
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setLocalError(null);
  };

  const displayError = error ?? localError;

  return (
    // Author: samir
    // Impact: wrapper now flex-col + h-full so the drop zone can stretch to fill the parent card
    // Reason: Logo card sits next to the taller Brand colours card in the same grid row — without h-full + flex-1, the drop zone left empty space at the bottom of the Logo card
    <div className="w-full h-full flex flex-col">
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload logo"
      />

      {/* Author: samir */}
      {/* Impact: button wraps the whole upload surface so the entire dashed zone is clickable + keyboard-accessible */}
      {/* Reason: the Figma design treats the dashed rectangle as one big drop target — using <button> gives us native focus ring and keyboard Enter/Space handling for free */}
      {/* Old Author: samir */}
      {/* New Author: samir */}
      {/* Impact: drop zone now uses a plain 1px solid border instead of the dashed double-thick one and stretches to fill remaining card height */}
      {/* Reason: user requested a normal border style — dashed felt heavy against the rest of the card chrome which uses simple solid borders. flex-1 closes the empty space at the bottom of the Logo card. */}
      <button
        type="button"
        onClick={handlePick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative w-full flex-1 rounded-xl border transition-colors cursor-pointer overflow-hidden',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#042E93]/40',
          dragActive
            ? 'border-[#042E93] bg-[#042E93]/5'
            : displayError
            ? 'border-red-400 bg-red-50/30'
            : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
        ].join(' ')}
        aria-label={value ? 'Change logo' : 'Upload logo'}
      >
        {/* Author: samir */}
        {/* Impact: drop zone is more compact — smaller min-height and tighter padding */}
        {/* Reason: previous min-h-40 + py-10 made the upload area stretch tall, especially when the card sat at full width. Design shows a compact zone closer to ~140px tall with the icon + label tightly grouped */}
        {value ? (
          // --- Preview state ---
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-6 min-h-32">
            {/* Use <img> rather than next/image for base64 data URLs — */}
            {/* Next's image loader doesn't handle data: URLs by default. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded logo preview"
              className="max-h-20 max-w-full object-contain"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">Logo uploaded</span>
              <span
                role="button"
                tabIndex={0}
                onClick={handleRemove}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRemove(e as unknown as React.MouseEvent);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2.5 py-1 text-xs font-medium hover:bg-red-100 cursor-pointer"
                aria-label="Remove logo"
              >
                Remove
              </span>
            </div>
          </div>
        ) : (
          // --- Empty state ---
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-6 min-h-32">
            <UploadIcon />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Upload logo</p>
              <p className="mt-1 text-xs text-slate-500">
                PNG or SVG · Max 2 MB · Recommended 400×120px
              </p>
            </div>
          </div>
        )}
      </button>

      {displayError && (
        <p className="mt-1.5 text-xs text-red-500">{displayError}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour swatch + hex input row
// ---------------------------------------------------------------------------

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  error?: string;
}

/**
 * Paired colour swatch + hex text input. Clicking the swatch opens the
 * native colour picker. Typing a hex code in the input updates the
 * swatch in real time. Both are driven by the same value so they stay
 * in sync.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Branding
 */
function ColorField({ label, value, onChange, error }: ColorFieldProps) {
  const isValidHex = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
  const swatchColor = isValidHex ? value : '#E5E7EB';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        {/* Colour swatch — clickable to open native picker */}
        <label
          className="relative inline-flex items-center justify-center w-11 h-11 rounded-full border border-gray-200 shrink-0 cursor-pointer overflow-hidden"
          style={{ backgroundColor: swatchColor }}
          aria-label={`${label} swatch`}
        >
          <input
            type="color"
            value={isValidHex ? value : '#000000'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={`${label} picker`}
          />
        </label>

        {/* Hex text input */}
        <div className="flex-1 min-w-0">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#1A3C6E"
            error={error}
            aria-label={`${label} hex code`}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export const BrandingForm = forwardRef<BrandingFormHandle, BrandingFormProps>(
  function BrandingForm({ initialData, saved = false, className = '' }, ref) {
    const [formData, setFormData] = useState<BrandingFormData>({
      ...INITIAL_FORM_STATE,
      ...initialData,
    });
    const [errors, setErrors] = useState<
      Partial<Record<keyof BrandingFormData, string>>
    >({});

    // Author: samir
    // Impact: generic updateField preserves per-field types (string values throughout this form)
    // Reason: matches the pattern in WarehouseLocationForm so future non-string fields (e.g. a boolean DNS toggle) land without a type cast
    const updateField = useCallback(
      <K extends keyof BrandingFormData>(field: K, value: BrandingFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
          if (!prev[field]) return prev;
          const next = { ...prev };
          delete next[field];
          return next;
        });
      },
      [],
    );

    /**
     * Zod safeParse + surface field errors. Returns parsed data or null.
     *
     * @author samir
     * @created 2026-04-06
     * @module Module A - Branding
     */
    const runValidation = useCallback((): BrandingInput | null => {
      const result = brandingSchema.safeParse(formData);
      if (result.success) {
        setErrors({});
        return result.data;
      }

      const fieldErrors: Partial<Record<keyof BrandingFormData, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof BrandingFormData | undefined;
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return null;
    }, [formData]);

    useImperativeHandle(
      ref,
      () => ({
        validate: runValidation,
        getFormData: () => formData,
      }),
      [runValidation, formData],
    );

    /**
     * Placeholder handler for the "Verify DNS" button. A real DNS check
     * would hit an internal API that resolves SPF / DKIM / DMARC records
     * for the fromEmail domain. For now we just surface a friendly toast.
     *
     * @author samir
     * @created 2026-04-06
     * @module Module A - Branding
     */
    const handleVerifyDns = () => {
      toast.info('DNS verification is coming soon.');
    };

    return (
      <div className={`space-y-4 sm:space-y-6 ${className}`}>
        {/* Page subtitle — lives inside the form so the page component doesn't need to know about Branding copy */}
        <div>
          <h2 className="text-base font-semibold text-slate-900">Branding</h2>
          <p className="mt-1 text-sm text-slate-500">
            Applied to customer-facing quotes, invoices, and the client portal.
          </p>
        </div>

        {/* Author: samir */}
        {/* Impact: row goes 2-col at md (768px) instead of lg (1024px) */}
        {/* Reason: with the dashboard sidebar in place the content area sits below the lg breakpoint on most laptop screens, so the Logo + Brand colours cards were stacking and stretching to full width — the design shows them paired side-by-side */}
        {/* Row 1: Logo + Brand colours (2-col on md+, stacked on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Author: samir */}
          {/* Impact: Logo card is a full-height flex column so the LogoUploader can stretch into the empty space */}
          {/* Reason: previously the card matched the taller Brand colours card via grid stretch but the inner upload zone left a gap at the bottom — flex + h-full lets the dropzone fill it */}
          {/* Logo card */}
          <Card className="h-full flex flex-col">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Logo</h3>
            <div className="flex-1 flex flex-col">
              <LogoUploader
                value={formData.logoDataUrl}
                onChange={(dataUrl) => updateField('logoDataUrl', dataUrl)}
                error={errors.logoDataUrl}
              />
            </div>
          </Card>

          {/* Brand colours card */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Brand colours</h3>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Primary colours</p>
                <ColorField
                  label=""
                  value={formData.primaryColor}
                  onChange={(hex) => updateField('primaryColor', hex)}
                  error={errors.primaryColor}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Accent colour</p>
                <ColorField
                  label=""
                  value={formData.accentColor}
                  onChange={(hex) => updateField('accentColor', hex)}
                  error={errors.accentColor}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Row 2: Email sender identity card (full width) */}
        <Card>
          {/* Author: samir */}
          {/* Impact: Saved indicator now uses a slightly bolder weight + thicker check stroke to read clearly as a status badge */}
          {/* Reason: image #8 close-up shows the ✓ Saved indicator with stronger visual presence — text-sm font-medium with a 1.5 stroke was too light against the surrounding card chrome */}
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Email sender identity</h3>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.3 4.3L6 11.6L2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Saved
              </span>
            )}
          </div>

          {/* Author: samir */}
          {/* Impact: info banner text is now darker blue (text-blue-800) and medium-weight to match the Figma design */}
          {/* Reason: image clearly shows the body copy in a saturated blue, not slate gray — gray made the banner read as informational rather than action-required */}
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-300 px-4 py-3 mb-6">
            <span className="mt-0.5 shrink-0">
              <InfoIcon />
            </span>
            <p className="text-sm text-blue-800 font-medium">
              Configure your branded domain so automated emails (quotes, invoices,
              reminders) come from your business address. Requires DNS setup — your
              developer can assist.
            </p>
          </div>

          {/* Author: samir */}
          {/* Impact: removed " *" required asterisks from From name / From email labels */}
          {/* Reason: Figma design shows plain labels with no required indicators — Zod still enforces the requirement server- and client-side, the asterisks were a visual addition that didn't match the design */}
          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 xl:gap-x-8 2xl:gap-x-12">
            <Input
              label="From name"
              value={formData.fromName}
              onChange={(e) => updateField('fromName', e.target.value)}
              placeholder="Your business name"
              error={errors.fromName}
            />
            <Input
              label="From email"
              type="email"
              value={formData.fromEmail}
              onChange={(e) => updateField('fromEmail', e.target.value)}
              placeholder="bookings@yourbusiness.com.au"
              error={errors.fromEmail}
              autoComplete="email"
            />
            <Input
              label="Reply-to"
              type="email"
              value={formData.replyTo}
              onChange={(e) => updateField('replyTo', e.target.value)}
              placeholder="hello@yourbusiness.com.au"
              error={errors.replyTo}
              autoComplete="email"
            />
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-sm font-medium text-gray-700">DNS status</label>
              <div className="flex items-center gap-3 min-h-12">
                {/* Old Author: samir */}
                {/* New Author: samir */}
                {/* Impact: Pending pill + Verify DNS button now use text-sm + larger padding (h-9-ish) */}
                {/* Reason: image #7 — previous text-xs / py-1 sizing made the controls feel undersized next to the h-12 input pills above. Bumping the padding gives them visual weight in line with the rest of the email-sender row. */}
                <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 border border-orange-300 px-4 py-1.5 text-sm font-semibold">
                  Pending
                </span>
                <button
                  type="button"
                  onClick={handleVerifyDns}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Verify DNS
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  },
);

