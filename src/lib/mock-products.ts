/**
 * Temporary mock products dataset shared by the Products list page and
 * the Product Details edit page so both agree on the same rows while
 * the backend (Product model + /api/orgs/current/products endpoints)
 * is being built in a follow-up PR.
 *
 * When the API lands:
 *   - delete this file
 *   - replace `import { MOCK_PRODUCTS } from "@/lib/mock-products"`
 *     with `useProducts()` from `@/hooks/products/useProducts`
 *   - the type lives in `@/types/products` already, so no other
 *     consumer changes are needed
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products (mock data)
 */

// Author: Puran
// Impact: single source of mock products for both list + edit pages
// Reason: avoids the list and the edit form drifting apart while we
//         wait for the real API. Deleted in the same commit that adds
//         the backend.

import type { Product } from "@/types/products";

/**
 * Extends the lean catalogue `Product` shape with the additional
 * fields the detail/edit page needs (description, configurable flag,
 * image URLs, tags). When the real model lands these will be columns
 * on the same row, not a parallel type — keeping it merged here for
 * now means the swap stays a single import line.
 */
export interface ProductDetail extends Product {
  subcategory?: string;
  description: string;
  configurable: boolean;
  /** Image URLs in display order; the first is the primary photo */
  images: string[];
  tags: string[];
}

export const MOCK_PRODUCTS: ProductDetail[] = [
  {
    id: "p1",
    sku: "SKU-001",
    name: "Big Blue Castle",
    category: "Inflatable",
    subcategory: "",
    quantity: 2,
    basePrice: 280,
    setupMinutes: 45,
    packdownMinutes: 30,
    status: "ACTIVE",
    description:
      "Large inflatable jumping castle in blue and white. Suitable for children up to 12 years. Requires a flat grass or concrete surface minimum 6m × 6m.",
    configurable: false,
    images: [],
    tags: ["Kids", "Outdoor", "Popular"],
  },
  {
    id: "p2",
    sku: "SKU-002",
    name: "Princess Palace",
    category: "Inflatable",
    quantity: 1,
    basePrice: 320,
    setupMinutes: 45,
    packdownMinutes: 30,
    status: "ACTIVE",
    description:
      "Themed princess castle with turrets and pink accents. A favourite for birthday parties.",
    configurable: false,
    images: [],
    tags: ["Kids", "Themed"],
  },
  {
    id: "p3",
    sku: "SKU-003",
    name: "Jungle Run Combo",
    category: "Inflatable",
    quantity: 3,
    basePrice: 410,
    setupMinutes: 60,
    packdownMinutes: 35,
    status: "ACTIVE",
    description:
      "Combo unit with a jumping area, slide, and obstacle tunnel. Bigger setup footprint — confirm site dimensions on quote.",
    configurable: true,
    images: [],
    tags: ["Combo", "Outdoor"],
  },
  {
    id: "p4",
    sku: "SKU-004",
    name: "Mega Slide",
    category: "Inflatable",
    quantity: 2,
    basePrice: 360,
    setupMinutes: 50,
    packdownMinutes: 30,
    status: "ACTIVE",
    description: "Tall inflatable slide. Two lanes side-by-side.",
    configurable: false,
    images: [],
    tags: ["Slide"],
  },
  {
    id: "p5",
    sku: "SKU-005",
    name: "Sumo Wrestling",
    category: "Game",
    quantity: 1,
    basePrice: 220,
    setupMinutes: 25,
    packdownMinutes: 20,
    status: "MAINTENANCE",
    description:
      "Inflatable sumo suits with mat. Currently flagged for maintenance — repair on the second suit's velcro.",
    configurable: false,
    images: [],
    tags: ["Game", "Adults"],
  },
  {
    id: "p6",
    sku: "SKU-006",
    name: "Carousel Ride",
    category: "Ride",
    quantity: 1,
    basePrice: 540,
    setupMinutes: 75,
    packdownMinutes: 60,
    status: "ACTIVE",
    description:
      "Powered carousel with 6 horses. Requires generator hire if no power on site.",
    configurable: true,
    images: [],
    tags: ["Ride", "Premium"],
  },
  {
    id: "p7",
    sku: "SKU-007",
    name: "Bungee Run",
    category: "Game",
    quantity: 1,
    basePrice: 0,
    setupMinutes: 30,
    packdownMinutes: 20,
    status: "NO_PRICE",
    description:
      "Two-lane inflatable bungee run. Pricing not yet configured — set base price before publishing to quotes.",
    configurable: false,
    images: [],
    tags: ["Game"],
  },
  {
    id: "p8",
    sku: "SKU-008",
    name: "Obstacle Course XL",
    category: "Inflatable",
    quantity: 2,
    basePrice: 480,
    setupMinutes: 70,
    packdownMinutes: 45,
    status: "ACTIVE",
    description:
      "Large inflatable obstacle course with multiple challenge zones. Crew of two recommended for setup.",
    configurable: true,
    images: [],
    tags: ["Outdoor", "Premium"],
  },
  {
    id: "p9",
    sku: "SKU-009",
    name: "Mini Train",
    category: "Ride",
    quantity: 1,
    basePrice: 0,
    setupMinutes: 50,
    packdownMinutes: 40,
    status: "NO_PRICE",
    description:
      "Track-based mini train. Pricing not yet configured — operational rules need review before quoting.",
    configurable: true,
    images: [],
    tags: ["Ride", "Kids"],
  },
];

/**
 * Looks up a product by id. Returns undefined when not found so the
 * caller can render a 404-style empty state.
 */
export function findMockProduct(id: string): ProductDetail | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}
