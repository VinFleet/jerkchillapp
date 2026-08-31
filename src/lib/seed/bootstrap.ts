import { ensureRecipesSeeded } from "@/lib/repo/recipes";
import { ensureStockSeeded } from "@/lib/repo/stock";
import { ensureChecklistsSeeded } from "@/lib/repo/checklists";
import { ensureNoticesSeeded } from "@/lib/repo/notices";
import { ensureFoodSafetySeeded } from "@/lib/repo/foodSafety";
import { ensureSuppliersSeeded } from "@/lib/repo/suppliers";
import { ensureContactsSeeded } from "@/lib/repo/contacts";
import { ensureLicensingSeeded } from "@/lib/repo/licensing";
import { ensureStaffSeeded } from "@/lib/repo/staff";
import { ensureMenuSeeded } from "@/lib/repo/menu";
import { ensureShoppingSeeded } from "@/lib/repo/shopping";
import { ensureDeliveryPerformanceSeeded } from "@/lib/repo/deliveryPerformance";
import { ensurePromotionsSeeded } from "@/lib/repo/promotions";
import { repairVoidedOrders, backfillSentLines } from "@/lib/repo/orders";

export function ensureAllSeeded() {
  ensureRecipesSeeded();
  ensureStockSeeded();
  ensureChecklistsSeeded();
  ensureNoticesSeeded();
  ensureFoodSafetySeeded();
  ensureSuppliersSeeded();
  ensureContactsSeeded();
  ensureLicensingSeeded();
  ensureStaffSeeded();
  ensureMenuSeeded();
  ensureShoppingSeeded();
  ensureDeliveryPerformanceSeeded();
  ensurePromotionsSeeded();
  repairVoidedOrders();
  backfillSentLines();
}
