import type { Supplier } from "@/lib/types";

// Real suppliers from OPERATIONS_AND_FOOD_SAFETY_DATA.md Part F. Kamereo,
// Thái Thịnh, and Gọi Đá are real, currently-used suppliers. The liquor
// supplier isn't named yet, so it's seeded as a clearly-labeled placeholder —
// per the spec a restaurant like this never has just one supplier (separate
// beer, liquor, market and ice suppliers) — so the structure is ready, but no
// fabricated business name or certs are entered for the one not set up yet.

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup_kamereo",
    name: "Kamereo",
    category: "grocery",
    status: "approved",
  },
  {
    id: "sup_thai_thinh",
    name: "Công ty TNHH MTV Thái Thịnh",
    category: "beer",
    contactId: "ct_thai_thinh",
    status: "approved",
  },
  {
    id: "sup_liquor_tbd",
    name: "Liquor supplier — add details",
    category: "liquor",
    status: "review",
  },
  {
    id: "sup_market_tbd",
    name: "Local market — Thảo Điền",
    category: "produce_market",
    status: "review",
  },
  {
    id: "sup_goi_da",
    name: "Gọi Đá",
    category: "ice",
    contactId: "ct_goi_da",
    status: "approved",
  },
];
