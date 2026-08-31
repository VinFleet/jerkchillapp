import type { Promotion, Bi } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId } from "@/lib/storage";

/**
 * The discounts a waiter can apply with one tap.
 *
 * Configured once by a manager and then chosen, never typed. Keying "20" as a
 * percentage when 20,000d was meant is a mistake that only shows up when the
 * takings are counted, and by then the guest has gone.
 *
 * Reference data under rule 5: it seeds identically on every device and a
 * manager edits it rarely, from one place.
 */

const KEY = "promotions";

/**
 * Starting set, drawn from what the restaurant already runs — the Lunch Box
 * window, Roast Sunday, and the two reductions every restaurant ends up
 * making. All editable; none of them are guesses about pricing policy.
 */
const SEED_PROMOTIONS: Promotion[] = [
  {
    id: "promo_staff",
    label: { en: "Staff meal (50%)", vi: "Suất nhân viên (50%)" },
    kind: "percent",
    value: 50,
    active: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "promo_koc",
    label: { en: "KOC / influencer (100%)", vi: "KOC / người ảnh hưởng (100%)" },
    kind: "percent",
    value: 100,
    active: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "promo_service_recovery",
    label: { en: "Service recovery (20%)", vi: "Xin lỗi khách (20%)" },
    kind: "percent",
    value: 20,
    active: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "promo_50k_off",
    label: { en: "50,000d off", vi: "Giảm 50.000d" },
    kind: "amount",
    value: 50000,
    active: true,
    updatedAt: new Date(0).toISOString(),
  },
];

export function ensurePromotionsSeeded() {
  if (isSeeded(KEY)) return;
  writeList(KEY, SEED_PROMOTIONS);
  markSeeded(KEY);
}

export function getPromotions(activeOnly = true): Promotion[] {
  const all = readList<Promotion>(KEY);
  return activeOnly ? all.filter((p) => p.active) : all;
}

export function addPromotion(label: Bi, kind: Promotion["kind"], value: number): Promotion {
  const promotion: Promotion = {
    id: newId("promo"),
    label,
    kind,
    // A percentage over 100 or under 0 is a typo; whole dong otherwise.
    value: kind === "percent" ? Math.min(100, Math.max(0, Math.round(value))) : Math.max(0, Math.round(value)),
    active: true,
    updatedAt: new Date().toISOString(),
  };
  writeList(KEY, [...readList<Promotion>(KEY), promotion]);
  return promotion;
}

export function setPromotionActive(id: string, active: boolean) {
  const all = readList<Promotion>(KEY);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], active, updatedAt: new Date().toISOString() };
  writeList(KEY, all);
}
