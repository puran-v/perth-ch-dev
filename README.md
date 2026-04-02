This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


## Give this prompt first before start in first.
```
    Read PROJECT_RULES.md and AGENTS.md completely before doing anything.

You MUST strictly follow ALL rules in PROJECT_RULES.md and check as well below rules. This is the single source of truth and overrides everything.

Execution Guidelines:
1. Fully understand the task before writing code. If unclear → STOP and ask.
2. Think step-by-step: architecture → database → API → frontend.
3. Implement only production-ready, scalable, and clean code.

Core Rules (NON-NEGOTIABLE):
- Multi-tenant: EVERY table and query MUST include orgId (never trust client input, always from session)
- Booking ID is the central reference across all modules
- Strict TypeScript (no `any`, full types everywhere)
- Zod validation REQUIRED for every API input
- API pattern: Auth → RBAC → orgId → business logic → response
- Prisma queries MUST always include `where: { orgId }`
- Proper error handling (standard success/error response format)
- Soft delete only (no permanent deletes)

Architecture & Code:
- Follow exact project folder structure and module boundaries
- Use RESTful API conventions (App Router, route.ts)
- Add JSDoc for all functions
- Add comments explaining WHY for complex logic
- Keep components modular (<200 lines)

Frontend Rules:
- Mobile-first responsive design (all breakpoints)
- Use Tailwind design tokens ONLY (no hex, no inline styles)
- Use typography tokens (no default Tailwind sizes)
- Use React Query for all server state (no manual fetch/useEffect)
- Proper loading, error, and empty states
- Accessibility required (aria, keyboard support)

AI Rules:
- AI only suggests, NEVER auto-executes
- Always include explanation ("why")
- Use module-based AI structure via API routes

Before Final Output (MANDATORY CHECK):
- All queries scoped by orgId
- No TypeScript violations
- Zod validation present
- API follows required pattern
- UI follows design system
- Fully responsive
- No rule violations

If ANY rule is violated → FIX before returning.

Output ONLY clean, final, production-ready code.

```


## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
