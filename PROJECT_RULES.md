# PerthBCH Operations Platform — Project Rules & Standards

> **This document is the single source of truth for every developer and every AI coding agent working on this project.**
> Read this BEFORE writing any code. If something contradicts this document, this document wins.

---

First read the AGENTS.md from the project files and go according to it so our project can no be break.

## 1. Project Identity

| Field            | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| **Project**      | PerthBouncy CastleHire — Internal Operations Platform                          |
| **Client**       | Perthbouncycastlehire (Perth, Western Australia)                               |
| **Stack**        | Next.js 15+ (App Router), TypeScript, PostgreSQL, Prisma ORM, Anthropic Claude API |
| **Architecture** | Multi-tenant from day one                                                      |
| **Scope**        | Scope 1: Quoting, Booking, Inventory, Warehouse, Finance + CSV Import          |
| **Design**       | Figma file or images are provided — all UI must match pixel-for-pixel          |

Project requirements document you can refer and understand : https://docs.google.com/document/d/127QUQEoTzmUV5cyIq8aJ5XN_hcXudNBk/edit

Scope 1 — Operations Platform -- we will focus on this module right now : https://docs.google.com/document/d/1cZNmDEcIt1Ajke7-PN5B794h7_SC84oBg_QoCeEmkl8/edit?usp=drive_link
---
## 1.0.1 make sure that this point should be never miss.
  1. Read PROJECT_RULES.md — check the relevant section for every change                                                               
  2. Follow AGENTS.md — read Next.js docs from node_modules/next/dist/docs/ before writing code                                        
  3. Reference the Google Docs — project requirements + Scope 1 specs for context                                                      
  4. Use gitconfig for all author comments (// Author: — name) and Co-Authored-By                                                       
  5. Verify alignment with all applicable rules before committing  

## 1.1 Make sure to use utils and services
- Ensure all reusable or common logic is abstracted into shared functions, components, or services. Avoid hardcoding or duplicating logic across the codebase. Examples include utilities like getToken, getCurrentUser, and centralized API services (e.g., Axios-based ApiService). Follow the defined project structure and standard full-stack best practices.

- Before creating any new function, service, hook, or authentication logic, first check if an existing implementation already exists and reuse it. If it does not exist, create it in the appropriate module. If the logic has potential for reuse, place it in a shared or reusable location to ensure consistency and maintainability across the project.

- If any files contain whitespaces, backslash-escaped

- If you add something in project which demands the .env variable so put that on .env.examples so we can know which one we have to add.



## 2. The Golden Rules (Non-Negotiable)

These rules override everything else. Every developer and AI agent must follow these without exception.

### 2.1 Multi-Tenant Architecture

- **Every database table MUST have an `org_id` column** (except pure system/config tables like migrations).
- **Every database query MUST be scoped to `org_id`**. No exceptions. No "we'll add it later."
- **Every API route MUST validate `org_id`** from the authenticated session before any data operation.
- **Never use `.findMany()` or `.findFirst()` without a `where: { orgId }` clause.**
- **Never trust client-sent `orgId`.** Always derive it from the server-side session.
- **Row-Level Security (RLS):** If using Supabase/PostgreSQL directly, enable RLS policies per table.
- **Test by asking:** "If Tenant A calls this endpoint, can they ever see Tenant B's data?" If the answer is anything other than "absolutely not," fix it.

```typescript
// CORRECT — always scoped
const bookings = await prisma.booking.findMany({
  where: { orgId: session.orgId, status: 'CONFIRMED' }
});

// WRONG — missing org_id scope
const bookings = await prisma.booking.findMany({
  where: { status: 'CONFIRMED' }
});
```

### 2.2 Booking ID is the Platform's Spine

- **Booking ID (format: `BK-XXXXX`)** is the primary foreign key across the entire system.
- Every table that relates to a job — reservations, invoices, warehouse tasks, run assignments — MUST carry a `bookingId`.
- Nothing moves to execution without a valid Booking ID.

### 2.2.1 Make sure after change or add or modify the things just add like 
```
// Author — always use from gitconfig scoped
// Impact: -- it should be short
// Reason: -- it should be short
const bookings = await prisma.booking.findMany({
  where: { orgId: session.orgId, status: 'CONFIRMED' }
});
or suppose in modifications if you modified another dev code so just replace

// Old Author — always use from gitconfig scoped
// New Author — always use from gitconfig scoped
// Impact: -- it should be replace with old one
// Reason: -- it should be replace with old one
const bookings = await prisma.booking.findMany({
  where: { orgId: session.orgId, status: 'CONFIRMED' }
});
```

### 2.2.2 Git Commit Co-Authored-By Rule

- **Every commit MUST include a `Co-Authored-By` trailer** using the values from `git config user.name` and `git config user.email`.
- **NEVER use AI/bot attribution** (e.g., "Claude Opus", "noreply@anthropic.com") in the Co-Authored-By line.
- Always run `git config user.name` and `git config user.email` before committing to get the correct values.

```
Co-Authored-By: <git config user.name> <<git config user.email>>

# Example:
Co-Authored-By: samir <jay@shipfast.agency>
```


### 2.3 AI Assists, Never Auto-Executes

- No AI engine sends emails, confirms bookings, modifies records, or processes payments without human approval.
- Every AI output is a suggestion, recommendation, or draft.
- Every AI recommendation MUST include a "why" explanation.
- All AI features use the Anthropic Claude API via Next.js API routes with module-specific system prompts.

### 2.4 Responsive Design — All Screens

- Every page and component MUST be fully responsive: desktop, tablet, and mobile.
- Use a mobile-first approach with Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`.
- The warehouse module (Module C) MUST work well on mobile — warehouse staff use phones/tablets.
- Test at these breakpoints: 320px (small mobile), 375px (mobile), 768px (tablet), 1024px (small laptop), 1440px (desktop).

### 2.5 Core Behavior

- Do NOT write code until you fully understand the request.
- Always think step-by-step before implementation.
- If something is unclear or violates rules — STOP and ask.
- Prioritize correctness, scalability, and consistency over speed.

---

## 3. Project Structure

```
perthbch-platform/
├── .env.local                    # Environment variables (never commit)
├── .env.example                  # Template for env vars (commit this)
├── PROJECT_RULES.md              # THIS FILE — the source of truth
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Seed data for development
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── (auth)/               # Auth pages (login, register, onboarding)
│   │   ├── (dashboard)/          # Main app layout with sidebar
│   │   │   ├── bookings/         # Module A pages
│   │   │   ├── inventory/        # Module B pages
│   │   │   ├── warehouse/        # Module C pages
│   │   │   ├── finance/          # Module D pages
│   │   │   ├── scheduling/       # Scheduling integration pages
│   │   │   └── settings/         # Admin settings
│   │   └── api/                  # API routes
│   │       ├── bookings/         # Module A APIs
│   │       ├── inventory/        # Module B APIs
│   │       ├── warehouse/        # Module C APIs
│   │       ├── finance/          # Module D APIs
│   │       ├── ai/               # AI engine endpoints
│   │       └── import/           # CSV import endpoints
│   ├── components/
│   │   ├── ui/                   # Shared UI primitives (Button, Input, Modal, etc.)
│   │   ├── layout/               # Layout components (Sidebar, Header, etc.)
│   │   ├── bookings/             # Module A components
│   │   ├── inventory/            # Module B components
│   │   ├── warehouse/            # Module C components
│   │   └── finance/              # Module D components
│   ├── lib/
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── auth.ts               # Auth helpers
│   │   ├── ai/                   # Claude API integration layer
│   │   │   ├── client.ts         # Base Claude API client
│   │   │   ├── sales-ai.ts       # Module A AI engine
│   │   │   ├── inventory-ai.ts   # Module B AI engine
│   │   │   ├── warehouse-ai.ts   # Module C AI engine
│   │   │   └── finance-ai.ts     # Module D AI engine
│   │   ├── email/                # Email builder and automation
│   │   ├── payments/             # Payment gateway integrations
│   │   └── utils/                # Shared utility functions
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # TypeScript type definitions
│   │   ├── booking.ts
│   │   ├── inventory.ts
│   │   ├── warehouse.ts
│   │   ├── finance.ts
│   │   └── shared.ts
│   └── constants/                # App-wide constants and enums
├── docs/                         # Module documentation (auto-maintained)
│   ├── module-a-bookings.md
│   ├── module-b-inventory.md
│   ├── module-c-warehouse.md
│   ├── module-d-finance.md
│   ├── api-reference.md
│   └── data-flow.md
├── public/                       # Static assets
└── tests/                        # Test files mirroring src structure
```

### Rules for File Placement

- **One component per file.** No file should export more than one React component.
- **Co-locate related files.** If a component has a hook that only it uses, put it in the same folder.
- **Module boundaries are strict.** Module A code never imports directly from Module C's folder. Shared logic goes in `lib/` or `components/ui/`.
- **API routes follow RESTful naming.** `api/bookings/[id]/route.ts`, not `api/getBooking.ts`.

---

## 4. Coding Standards

### 4.1 TypeScript — Strict Mode

- `strict: true` in `tsconfig.json`. No exceptions.
- **No `any` type.** If you don't know the type, define it or use `unknown` with type guards.
- All API responses must have typed interfaces.
- All database models must have corresponding TypeScript types.

```typescript
// CORRECT
interface CreateBookingInput {
  orgId: string;
  customerId: string;
  items: BookingItemInput[];
  deliveryAddress: AddressInput;
  timeWindows: TimeWindowInput;
}

// WRONG
function createBooking(data: any) { ... }
```

### 4.2 Function & Method Documentation

Every function MUST have a JSDoc comment that includes:

```typescript
/**
 * Calculates the total price for a booking including delivery fees,
 * discounts, and tax (GST). Uses the pricing snapshot from the accepted
 * quote to ensure price consistency.
 *
 * @param booking - The booking record with items and pricing rules
 * @param discountCode - Optional discount code to apply
 * @returns Calculated totals including subtotal, tax, discount, and grand total
 *
 * @example
 * const totals = calculateBookingTotal(booking, 'SUMMER10');
 * // { subtotal: 1200, discount: 120, tax: 108, total: 1188 }
 *
 * @author Dev1 (take this from gitconfig or "AI-assisted" if Claude Code wrote it)
 * @created 2026-04-01
 * @module Module A - Quoting & Booking
 */
export function calculateBookingTotal(
  booking: BookingWithItems,
  discountCode?: string
): BookingTotals {
  // ...
}
```

### 4.3 Complex Logic Must Have Inline Comments

If any logic would take another developer more than 30 seconds to understand, add comments explaining **WHY**, not just WHAT.

```typescript
// CORRECT — explains the business rule behind the logic
// Business rule: Equipment reserved for a booking cannot be double-booked.
// We check availability by looking at all reservations that overlap with
// the requested date range, then subtract from total quantity.
// Example: If we own 3 bouncy castles and 2 are reserved for March 15,
// availability = 3 - 2 = 1 remaining for that date.
const overlapping = await prisma.reservation.findMany({
  where: {
    orgId,
    productId,
    status: 'CONFIRMED',
    startDate: { lte: requestedEndDate },
    endDate: { gte: requestedStartDate },
  },
});
const reserved = overlapping.reduce((sum, r) => sum + r.quantity, 0);
const available = product.totalQuantity - reserved;

// WRONG — states the obvious without explaining why
// Get reservations and calculate available
const overlapping = await prisma.reservation.findMany({ ... });
```

### 4.4 Naming Conventions

| Element              | Convention                   | Example                                |
| -------------------- | ---------------------------- | -------------------------------------- |
| Files (components)   | PascalCase                   | `BookingDetails.tsx`                   |
| Files (utilities)    | camelCase                    | `calculatePricing.ts`                  |
| Files (API routes)   | lowercase with hyphens       | `route.ts` inside `api/bookings/`      |
| React components     | PascalCase                   | `QuoteBuilder`                         |
| Functions/variables  | camelCase                    | `getAvailableProducts()`               |
| Constants            | SCREAMING_SNAKE              | `MAX_DISCOUNT_PERCENT`                 |
| Database tables      | PascalCase (Prisma)          | `Booking`, `BookingItem`               |
| Database columns     | camelCase (Prisma)           | `orgId`, `createdAt`, `bookingId`      |
| API endpoints        | kebab-case                   | `/api/bookings/[id]/line-items`        |
| CSS classes          | Tailwind utilities           | `className="flex items-center gap-4"`  |
| Enums                | PascalCase with UPPER values | `BookingStatus.CONFIRMED`              |
| Types/Interfaces     | PascalCase with prefix       | `BookingWithItems`, `CreateBookingInput`|

### 4.5 Error Handling

- **Every API route MUST have try/catch with proper error responses.**
- **Never swallow errors silently.** Always log with context.
- **User-facing errors must be helpful.** Not "Something went wrong" but "Unable to reserve equipment — Item X is already booked for this date."

```typescript
// Standard error response format
interface ApiError {
  success: false;
  error: {
    code: string;        // Machine-readable: 'BOOKING_CONFLICT'
    message: string;     // Human-readable: 'Equipment already reserved for this date'
    details?: unknown;   // Optional additional context
  };
}

// Standard success response format
interface ApiSuccess<T> {
  success: true;
  data: T;
}
```

### 4.6 Input Validation (Zod — Non-Negotiable)

- **EVERY API route MUST validate input using Zod** before business logic.
- **NEVER trust `req.json()` directly.**

```typescript
const schema = z.object({
  customerId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1)
  }))
});

const body = await req.json();
const parsed = schema.parse(body);
```

---

## 5. Database Design Rules

### 5.1 Every Table Must Include

```prisma
model ExampleTable {
  id        String   @id @default(cuid())
  orgId     String                          // MANDATORY — multi-tenant scope
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?                         // User ID who created the record
  updatedBy String?                         // User ID who last updated

  org       Organization @relation(fields: [orgId], references: [id])

  @@index([orgId])                          // MANDATORY — index on orgId
}
```

### 5.2 Booking ID as Foreign Key

```prisma
model Reservation {
  id         String   @id @default(cuid())
  orgId      String
  bookingId  String                          // Links to the Booking
  productId  String
  quantity   Int
  startDate  DateTime
  endDate    DateTime
  status     ReservationStatus @default(CONFIRMED)

  org        Organization @relation(fields: [orgId], references: [id])
  booking    Booking      @relation(fields: [bookingId], references: [id])
  product    Product      @relation(fields: [productId], references: [id])

  @@index([orgId])
  @@index([bookingId])
  @@index([productId, startDate, endDate])   // Composite index for availability queries
}
```

### 5.3 Soft Delete, Never Hard Delete

- **Never delete records permanently.** Use a `deletedAt` timestamp.
- Financial records (invoices, payments) must NEVER be deleted — they are void/credited instead.
- This is required for audit compliance and data recovery.

```prisma
model Booking {
  // ...
  deletedAt DateTime?   // null = active, timestamp = soft-deleted
}
```

### 5.4 Pricing Snapshot Rule

- When a quote is accepted, the prices are LOCKED on the booking record.
- Future catalogue price changes must NOT affect accepted quotes/bookings.
- Store a `pricingSnapshot` JSON field on the booking with all prices at the time of acceptance.

### 5.5 Invoice Number Rule

- One invoice number per booking for the full lifecycle.
- Deposit and balance are line items within a single invoice, NOT separate invoices.
- Invoice numbers are sequential per org: `INV-00001`, `INV-00002` (configurable prefix).

### 5.6 Migration Safety Rules

- **NEVER run destructive migrations without backup.**
- Always use `npx prisma migrate dev` (local) and `npx prisma migrate deploy` (prod).
- Add indexes BEFORE scaling.

---

## 6. API Design Rules

### 6.1 RESTful Conventions

```
GET    /api/bookings              → List bookings (paginated, filtered by orgId)
GET    /api/bookings/[id]         → Get single booking
POST   /api/bookings              → Create booking
PATCH  /api/bookings/[id]         → Update booking
DELETE /api/bookings/[id]         → Soft-delete booking

GET    /api/bookings/[id]/items   → List booking items
POST   /api/bookings/[id]/items   → Add item to booking
```

### 6.2 Pagination Standard

All list endpoints MUST support pagination:

```typescript
// Request: GET /api/bookings?page=1&limit=20&sort=createdAt&order=desc
// Response:
{
  success: true,
  data: Booking[],
  pagination: {
    page: 1,
    limit: 20,
    total: 156,
    totalPages: 8
  }
}
```

### 6.3 Authentication & Authorization Check Pattern

Every API route starts with the same pattern:

```typescript
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // Step 1: Authenticate
    const session = await getServerSession();
    if (!session) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Step 2: Authorize (check role-based permissions)
    if (!hasPermission(session.user, 'BOOKING_VIEW')) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Step 3: Extract orgId (NEVER trust client-sent orgId)
    const orgId = session.orgId;

    // Step 4: Business logic (always scoped to orgId)
    const data = await prisma.booking.findMany({ where: { orgId } });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('[GET /api/bookings]', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings' } },
      { status: 500 }
    );
  }
}
```

### 6.4 Performance SLAs

| Endpoint Type | Target Response Time       |
| ------------- | -------------------------- |
| GET endpoints | < 300ms                    |
| POST/PATCH    | < 500ms                    |
| AI endpoints  | < 5s (async preferred)     |

If slower, must justify.

---

## 7. Authorization (RBAC)

### 7.1 Roles

- you can check this docs and implement on apis or make sure to get the idea about the roles and permissions : 
- Doc Link: https://docs.google.com/spreadsheets/d/10NzxOdPMrwaDlf-yvjk74h0GKfVGEZuA_IL82QKofYU/edit?gid=0#gid=0

Example
- **ADMIN** — Full access, can delete bookings
- **MANAGER** — Can approve bookings, manage staff
- **STAFF** — Warehouse operations, standard tasks
- **DRIVER** — Delivery and pickup operations

### 7.2 Permission Rules

- Only ADMIN can delete bookings.
- Only MANAGER+ can approve bookings.
- Warehouse actions are available to STAFF + DRIVER.

```typescript
if (!hasPermission(session.user, 'BOOKING_APPROVE')) {
  return Response.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
    { status: 403 }
  );
}
```

---

## 8. Frontend / UI Rules

### 8.1 Component Architecture

- **Use Server Components by default.** Only add `'use client'` when you need interactivity (state, effects, event handlers).
- **Keep components small.** If a component exceeds 200 lines, split it.
- **Shared UI components go in `components/ui/`.** Module-specific components go in `components/[module]/`.
- **No inline styles.** Use Tailwind CSS exclusively.
- **No component should define its own styles.** Everything must use design tokens (see Section 10).

### 8.2 Responsive Design Implementation

```tsx
// CORRECT — mobile-first responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id} item={item} />)}
</div>

// CORRECT — responsive typography
<h1 className="text-h3 md:text-h2 lg:text-h1 font-bold">Dashboard</h1>

// CORRECT — hide/show elements per breakpoint
<Sidebar className="hidden lg:block" />           {/* Desktop sidebar */}
<MobileNavDrawer className="lg:hidden" />          {/* Mobile nav */}

// WRONG — fixed widths that break on mobile
<div style={{ width: '800px' }}>...</div>
```

### 8.3 Form Handling

- Use React Hook Form + Zod for all forms.
- Validation happens on BOTH client and server.
- Loading states on every submit button.
- Success/error toast notifications after every action.
- Disable submit while loading.
- Show inline validation errors.
- Preserve form state on error.
- Auto-focus first error field.

### 8.4 Data Tables

- Use a consistent data table component across all modules.
- Support: sorting, filtering, pagination, column visibility, row selection.
- Mobile view: switch from table to card layout below `md` breakpoint.

### 8.5 Loading & Empty States

Every async UI MUST have:
- **Loading skeleton** (no blank screens ever)
- **Error state** with helpful message
- **Empty state** with guidance

### 8.6 Figma-to-Code Rules

- Match the Figma design exactly — spacing, colors, typography, layout.
- If the Figma design doesn't show a mobile layout, create a sensible responsive version that maintains the same visual language.
- Extract all colors, fonts, and spacing values from Figma into Tailwind theme config.
- If something looks off, flag it — don't guess.

### 8.7 Accessibility

- All buttons must have `aria-label`.
- Forms must have labels.
- Keyboard navigation must work.
- Color contrast must meet WCAG.

---

## 9. State Management

### 9.1 Server State (Mandatory)

- All server data MUST be handled using **React Query (TanStack Query)**.
- **NEVER use `useEffect` + `fetch` manually for API calls.**

```typescript
// CORRECT
const { data, isLoading } = useQuery({
  queryKey: ['bookings', orgId],
  queryFn: fetchBookings
});

// WRONG
useEffect(() => {
  fetch('/api/bookings').then(...)
}, []);
```

### 9.2 Query Keys Standard

```typescript
['bookings', orgId]
['booking', bookingId]
['inventory', orgId]
```

### 9.3 Cache Invalidation

After mutations, always invalidate:

```typescript
queryClient.invalidateQueries(['bookings']);
```

---

## 10. Design System (Figma — Strict)

This section defines the design token system extracted from Figma. If Figma is inconsistent, developers MUST flag it before implementation.

### 10.1 Color System (Tailwind v4 — Token Based)

Colors MUST be used via design tokens only. **If you see a hex code in a component, it's a bug.**

#### Brand Colors

| Token       | Value                       |
| ----------- | --------------------------- |
| `primary`   | #D4FF00 (Chartreuse / Lime) |
| `secondary` | #00FFE0 (Aqua / Neon Teal)  |
| `accent`    | #FF2EC1 (Hot Pink)          |

#### Alert Colors

| Token     | Value   |
| --------- | ------- |
| `success` | #22C55E |
| `warning` | #FACC15 |
| `error`   | #F75555 |

#### Greyscale

| Token      | Value   |
| ---------- | ------- |
| `gray-50`  | #FCFCFD |
| `gray-100` | #F3F4F6 |
| `gray-200` | #E5E7EB |
| `gray-300` | #D1D5DB |
| `gray-400` | #9CA3AF |
| `gray-500` | #6B7280 |
| `gray-600` | #4B5563 |
| `gray-700` | #374151 |
| `gray-800` | #1F2937 |
| `gray-900` | #0F172A |

#### Additional Colors

| Token         | Value   |
| ------------- | ------- |
| `white`       | #FFFFFF |
| `mango`       | #FF9F29 |
| `blue`        | #0062FF |
| `purple`      | #764AF1 |
| `order-green` | #1A4D2E |

#### Semantic Usage Rules

| Use Case          | Token              |
| ----------------- | ------------------ |
| Primary buttons   | `primary`          |
| Secondary actions | `secondary`        |
| Highlights / CTA  | `accent`           |
| Success states    | `success`          |
| Warnings          | `warning`          |
| Errors            | `error`            |
| Backgrounds       | `gray-50`, `white` |
| Text primary      | `gray-900`         |
| Text secondary    | `gray-500`         |
| Borders           | `gray-200`         |

#### Tailwind v4 Setup (`src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-primary: #D4FF00;
  --color-secondary: #00FFE0;
  --color-accent: #FF2EC1;

  /* Alerts */
  --color-success: #22C55E;
  --color-warning: #FACC15;
  --color-error: #F75555;

  /* Greyscale */
  --color-gray-50: #FCFCFD;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #0F172A;

  /* Additional */
  --color-white: #FFFFFF;
  --color-mango: #FF9F29;
  --color-blue: #0062FF;
  --color-purple: #764AF1;
  --color-order-green: #1A4D2E;
}
```

```tsx
// CORRECT
<div className="bg-primary text-gray-900">Dashboard</div>
<div className="bg-success text-white">Success</div>

// WRONG — never use hex in components
<div className="bg-[#D4FF00]">
```

### 10.2 Typography System (Pixel-Exact from Figma)

#### Font Family

| Priority  | Font          |
| --------- | ------------- |
| Primary   | Inter         |
| Secondary | Space Grotesk |
| Secondary | DM Sans       |

Inter is the default everywhere unless explicitly overridden. Fonts MUST be loaded via Google Fonts or local assets. Download DM Sans: https://fonts.google.com/specimen/DM+Sans

**Rules:** Always use Tailwind v4 theme tokens (`text-h1`, `text-body-lg`, etc.). Never use Tailwind defaults (`text-sm`, `text-lg`) or arbitrary hardcoded values (`text-[18px]`).

#### Heading Scale

| Token | Size | Line Height | Weight | Usage                     |
| ----- | ---- | ----------- | ------ | ------------------------- |
| `h1`  | 48px | 56px        | 700    | `text-h1 font-bold`       |
| `h2`  | 40px | 48px        | 700    | `text-h2 font-bold`       |
| `h3`  | 32px | 40px        | 700    | `text-h3 font-bold`       |
| `h4`  | 24px | 32px        | 700    | `text-h4 font-bold`       |
| `h5`  | 20px | 28px        | 700    | `text-h5 font-bold`       |
| `h6`  | 18px | 24px        | 700    | `text-h6 font-bold`       |

#### Body Scale

| Token       | Size | Line Height | Variants (weight)             |
| ----------- | ---- | ----------- | ----------------------------- |
| `body-xl`   | 18px | 28px        | bold (700), medium (500), regular (400) |
| `body-lg`   | 16px | 24px        | bold (700), medium (500), regular (400) |
| `body-md`   | 14px | 20px        | bold (700), medium (500), regular (400) |
| `body-sm`   | 12px | 16px        | extrabold (800), medium (500), regular (400) |
| `body-xs`   | 10px | 14px        | extrabold (800), medium (500), regular (400) |

#### Tailwind v4 Typography Setup (`src/app/globals.css`)

```css
@theme {
  /* Headings */
  --text-h1: 48px;
  --text-h1--line-height: 56px;
  --text-h2: 40px;
  --text-h2--line-height: 48px;
  --text-h3: 32px;
  --text-h3--line-height: 40px;
  --text-h4: 24px;
  --text-h4--line-height: 32px;
  --text-h5: 20px;
  --text-h5--line-height: 28px;
  --text-h6: 18px;
  --text-h6--line-height: 24px;

  /* Body */
  --text-body-xl: 18px;
  --text-body-xl--line-height: 28px;
  --text-body-lg: 16px;
  --text-body-lg--line-height: 24px;
  --text-body-md: 14px;
  --text-body-md--line-height: 20px;
  --text-body-sm: 12px;
  --text-body-sm--line-height: 16px;
  --text-body-xs: 10px;
  --text-body-xs--line-height: 14px;
}
```

#### Quick Reference

| Figma Label  | Code                              |
| ------------ | --------------------------------- |
| Heading 1    | `text-h1 font-bold`               |
| Heading 2    | `text-h2 font-bold`               |
| Body Large   | `text-body-lg font-normal`         |
| Body Medium  | `text-body-md font-normal`         |
| Caption      | `text-body-sm font-normal`         |

```tsx
// CORRECT
<h1 className="text-h1 font-bold">Dashboard</h1>
<p className="text-body-lg font-normal">Description</p>

// WRONG — never use Tailwind defaults or arbitrary values
<h1 className="text-4xl">Dashboard</h1>
<p className="text-[18px]">Description</p>
```

**Typography is pixel-exact — even a 2px difference is a bug.**

### 10.3 Component Standards

#### Cards
```tsx
className="bg-white border border-gray-200 shadow-sm"
```

#### Inputs
```tsx
className="border border-gray-300 focus:border-primary"
```

---

## 11. Button Component (Single Source of Truth)

There is **ONLY ONE** Button component in the entire codebase: `components/ui/Button.tsx`. All buttons are variants of this component. No duplicate button implementations allowed.

### 11.1 Component API

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}
```

### 11.2 Variant Styles

| Variant     | Styles                                                     |
| ----------- | ---------------------------------------------------------- |
| `primary`   | `bg-primary text-gray-900 hover:opacity-90`                |
| `secondary` | `bg-gray-100 text-gray-900 hover:bg-gray-200`             |
| `outline`   | `border border-primary text-primary bg-transparent`        |
| `ghost`     | `bg-transparent text-gray-900 hover:bg-gray-100`          |

Recommended: use a config-driven approach:

```typescript
const buttonVariants = {
  primary: "bg-primary text-gray-900",
  secondary: "bg-gray-100 text-gray-900",
  outline: "border border-primary text-primary",
  ghost: "bg-transparent text-gray-900"
};
```

### 11.3 State Behavior

| State      | Behavior                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| Default    | `bg-primary text-gray-900`                                                  |
| Pressed    | `active:brightness-90` (use opacity/brightness, NOT new colors)             |
| Loading    | Replace text with spinner, maintain same width (no layout shift), disable click |
| Disabled   | `bg-gray-200 text-gray-400 cursor-not-allowed`                              |

### 11.4 Spinner Rules

- Spinner MUST be centered.
- Spinner color must match text color.
- Size scales with button: `lg` = `size-5`, `md` = `size-4`, `sm` = `size-3`.

```tsx
{loading ? <Spinner /> : children}
```

### 11.5 Width & Icon Support

- **Default width:** `fit-content`. Use `fullWidth?: boolean` for full-width.
- **Icons:** `leftIcon` and `rightIcon` props. Icons align center with `gap-2`, size scales with button.

### 11.6 Accessibility

```tsx
<button
  disabled={disabled || loading}
  aria-busy={loading}
>
```

### 11.7 Animation

Use subtle transitions only: `className="transition-all duration-200"` (150-200ms).

### 11.8 Usage Examples

```tsx
<Button variant="primary" size="lg">Create Booking</Button>
<Button variant="outline" size="md">Cancel</Button>
<Button loading size="lg">Saving...</Button>
<Button fullWidth variant="secondary">Continue</Button>
```

### 11.9 Anti-Patterns (Strictly Forbidden)

- Multiple button components
- Inline styles on buttons
- Random padding/height
- Custom colors outside tokens
- Text shifting during loading
- Inconsistent border radius
- Inventing new variants

---

## 12. AI Integration Rules

### 12.1 Claude API Client Pattern

```typescript
// lib/ai/client.ts — shared base client
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Base function for all AI engine calls. Each module provides its own
 * system prompt and context, but they all go through this function.
 */
export async function callClaudeAI({
  systemPrompt,
  userMessage,
  module,
  orgId,
}: {
  systemPrompt: string;
  userMessage: string;
  module: 'sales' | 'inventory' | 'warehouse' | 'finance' | 'scheduling';
  orgId: string;
}) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Log AI usage for audit and cost tracking
  await logAIUsage({ module, orgId, tokensUsed: response.usage });

  return response;
}
```

### 12.2 AI Response Format

Every AI engine must return structured responses:

```typescript
interface AIRecommendation {
  type: 'suggestion' | 'warning' | 'risk_flag' | 'draft';
  title: string;            // Short title: "Low margin warning"
  explanation: string;      // The "why": "Current margin is 21% which is below your 30% threshold"
  suggestedAction?: string; // What to do: "Consider adding logistics surcharge of $85"
  confidence: number;       // 0-1 confidence score
  data?: unknown;           // Any structured data the UI needs
}
```

---

## 13. Module Documentation Requirement

### 13.1 Every Sub-Module Gets a Doc

When you complete any sub-module or feature, create/update a documentation file in `docs/`. This is NOT optional.

**Required template for each feature:**

```markdown
# Feature: [Feature Name]

## Overview
One-line description of what this feature does.

## Flow
1. Step-by-step user/system flow

## API Endpoints
| Method | Endpoint | Description | Auth Required |

## Database Tables Involved
- Table — what happens to it

## Parameters / Inputs
| Parameter | Type | Required | Description |

## Business Rules
- Rule 1
- Rule 2

## AI Integration
- What AI does in this feature

## Error Scenarios
- Error condition → HTTP response
```

### 13.2 Keep Docs Updated

- If you change a feature, update its doc in the same PR/commit.
- Stale docs are worse than no docs.

---

### 14.2 Commit Messages (Conventional Commits)

```
feat(module-a): add quote builder with line items and grouped sections
fix(module-b): resolve double-booking conflict on same-day reservations
docs(module-c): add warehouse load board feature documentation
refactor(lib): extract shared pricing calculation into utility
chore(deps): update @anthropic-ai/sdk to latest
```

### 14.3 PR Requirements

- Every PR must reference the module it belongs to.
- Every PR must include updated docs if it changes behavior.
- Every PR must pass TypeScript strict mode with zero errors.
- No PR should touch more than one module at a time (unless cross-module integration).

---

## 15. Environment & Configuration

### 15.1 Environment Variables

```bash
# .env.example — commit this file
# .env.local   — NEVER commit this file

# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Payments (configure which are active in Phase 1)
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
SQUARE_ACCESS_TOKEN="..."
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."

# Email
EMAIL_FROM="noreply@perthbch.com.au"
SMTP_HOST="..."
SMTP_PORT="..."
SMTP_USER="..."
SMTP_PASS="..."

# Maps (for location display)
GOOGLE_MAPS_API_KEY="..."
```

### 15.2 Feature Flags

```typescript
// lib/features.ts
export const FEATURES = {
  MODULE_A_QUOTING: true,
  MODULE_A_EMAIL_AUTOMATION: false,  // Enable when ready
  MODULE_B_INVENTORY: true,
  MODULE_C_WAREHOUSE: false,         // Enable when scheduling API is ready
  MODULE_C_VOICE_AI: false,          // Enable when warehouse layout data is received
  MODULE_D_FINANCE: true,
  MODULE_D_STRIPE: true,
  MODULE_D_SQUARE: false,            // Awaiting confirmation
  MODULE_D_PAYPAL: false,            // Awaiting confirmation
  CSV_IMPORT: false,                 // Enable during cutover
} as const;
```

---

## 16. Testing Rules

### 16.1 What Must Be Tested

- **All business-critical logic:** pricing calculations, availability checking, reservation conflicts, invoice state machine, dispatch hold logic.
- **All API routes:** at minimum, test the happy path + auth failure + validation failure.
- **Multi-tenant isolation:** every test for data operations must verify org_id scoping.

### 16.2 Test Naming

```typescript
describe('Inventory Availability', () => {
  it('should return full availability when no reservations exist', async () => { ... });
  it('should subtract reserved quantities from availability', async () => { ... });
  it('should detect conflicts when stock is insufficient', async () => { ... });
  it('should NOT show reservations from a different org_id', async () => { ... }); // Multi-tenant test
});
```

---

## 17. Performance Rules

- **No N+1 queries.** Use Prisma `include` or `select` to load related data in one query.
- **Paginate all list endpoints.** Never return unbounded result sets.
- **Use database indexes** on all foreign keys and commonly filtered columns.
- **Lazy load heavy components.** Use `next/dynamic` for large charts, maps, and editors.
- **Optimize images.** Use `next/image` for all images.

---

## 18. Security Rules

- **Validate all inputs** with Zod schemas on the server side.
- **Sanitize all user content** before rendering (XSS prevention).
- **Rate limit AI endpoints** — Claude API calls cost money.
- **Secure the customer-facing portal** — quote links use time-limited tokens, not predictable IDs.
- **Log all financial operations** — every invoice creation, payment recording, and credit note is auditable.

---

## 19. Logging & Observability

- Use **structured logging (JSON)** — never `console.log` in production.
- Use a logger utility:

```typescript
logger.info('Booking created', { bookingId, orgId, userId });
```

- **Recommended tools:** Sentry (errors), Logtail / Datadog (logs).

---

## 20. Cross-Module Data Flow Contract

This is the integration contract. If you change any of these, notify ALL developers immediately.

### Module A -> Module B (On Booking Confirmation)

```typescript
// Trigger: Booking status changes to CONFIRMED
interface BookingConfirmedEvent {
  bookingId: string;
  orgId: string;
  items: {
    productId: string;
    quantity: number;
    startDate: string;  // ISO date
    endDate: string;    // ISO date
  }[];
}
// Action: Module B creates Reservation records for each item
```

### Module A -> Module D (On Booking Confirmation)

```typescript
// Trigger: Booking status changes to CONFIRMED
interface InvoiceCreationEvent {
  bookingId: string;
  orgId: string;
  customerId: string;
  pricingSnapshot: PricingSnapshot;  // Locked prices
  items: InvoiceLineItem[];
}
// Action: Module D creates Draft Invoice
```

### Module A -> Scheduling Tool (On Booking Confirmation/Update)

```typescript
interface SchedulingPushEvent {
  bookingId: string;
  orgId: string;
  address: Address;
  timeWindows: { start: string; end: string; strict: boolean };
  equipmentSummary: { totalWeight: number; totalVolume: number };
  setupDuration: number;    // minutes
  packdownDuration: number; // minutes
  constraints: string[];
  warehouseNotes: string;
}
```

### Scheduling Tool -> Module C (On Plan Publish)

```typescript
interface PublishedPlanEvent {
  orgId: string;
  runId: string;
  truckId: string;
  departureTime: string;
  returnTime: string;
  bookings: {
    bookingId: string;
    order: number;        // Stop order in the run
    estimatedArrival: string;
  }[];
}
// Action: Module C generates WarehouseTask records for each booking item
```

### Module D -> Module C (Dispatch Hold Check)

```typescript
// Module C calls this before marking a run as Ready
interface DispatchHoldCheck {
  bookingId: string;
  orgId: string;
}
interface DispatchHoldResult {
  bookingId: string;
  holdActive: boolean;       // true = payment outstanding
  holdReason?: string;       // "Balance of $450 unpaid"
  overrideAllowed: boolean;  // Based on user role
}
```

---

## 21. Quick Reference Checklist

Before writing any code, ask yourself:

1. Does my query include `orgId` in the WHERE clause?
2. Does my function have a JSDoc comment with `@author`, `@created`, `@module`?
3. Is this component responsive at 320px, 375px, 768px, 1024px, and 1440px?
4. Am I using the Booking ID as the foreign key where applicable?
5. Does my AI feature show recommendations (not auto-execute)?
6. Have I handled errors with proper user-facing messages?
7. Have I updated the module doc in `docs/`?
8. Am I using TypeScript strict types (no `any`)?
9. Does my API route validate authentication AND authorization?
10. Am I using design tokens (no hex colors, no Tailwind defaults)?

---

*This document is maintained alongside the codebase. Last updated: April 2026.*
*If you find a gap or conflict, raise it immediately — don't assume.*
