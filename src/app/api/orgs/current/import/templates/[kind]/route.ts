/**
 * GET /api/orgs/current/import/templates/[kind] — empty header-only CSV
 * download for the requested import kind.
 *
 * Wired to the "Download template CSV" buttons on the CSV Import page
 * and inside the Field Mapping Guide modal. The body is generated from
 * the same header constants the parser validates against, so the
 * template can never drift out of sync with what the importer accepts.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "@/server/lib/auth/guards";
import { error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";
import {
  buildTemplate,
  type TemplateKind,
} from "@/server/lib/csv-import/templates";

const ROUTE = "/api/orgs/current/import/templates/[kind]";

const KIND_VALUES = new Set<TemplateKind>(["customers", "products", "bookings"]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const logCtx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "import.run");
    if (permResult instanceof Response) return permResult;

    const { kind: kindParam } = await ctx.params;
    if (!KIND_VALUES.has(kindParam as TemplateKind)) {
      return error(
        "INVALID_KIND",
        `Unknown import kind "${kindParam}". Expected one of: customers, products, bookings.`,
        400,
      );
    }

    const { filename, body } = buildTemplate(kindParam as TemplateKind);

    // text/csv with attachment headers so the browser triggers a real
    // download instead of trying to render the response inline.
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error("Failed to build CSV template", logCtx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
      500,
    );
  }
}
