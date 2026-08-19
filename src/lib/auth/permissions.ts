import type { Role, StockSection, ChecklistArea, FoodSafetyLogType, AppSettings } from "@/lib/types";

export type ModuleId =
  | "recipes"
  | "stock"
  | "checklists"
  | "planner"
  | "notices"
  | "bookings"
  | "foodSafety"
  | "suppliers"
  | "contacts"
  | "licensing"
  | "sales"
  | "staff"
  | "menu"
  | "marketing"
  | "shopping"
  | "deliveryPerformance"
  | "usageVariance";

export const MODULE_ORDER: ModuleId[] = [
  "recipes",
  "stock",
  "checklists",
  "planner",
  "notices",
  "bookings",
  "foodSafety",
  "suppliers",
  "contacts",
  "licensing",
  "sales",
  "staff",
  "menu",
  "marketing",
  "shopping",
  "deliveryPerformance",
  "usageVariance",
];

const MODULE_ACCESS: Record<ModuleId, Role[]> = {
  recipes: ["owner", "manager", "chef"],
  stock: ["owner", "manager", "chef", "bartender"],
  checklists: ["owner", "manager", "chef", "bartender"],
  planner: ["owner", "manager", "chef"],
  notices: ["owner", "manager", "chef", "bartender"],
  bookings: ["owner", "manager", "bartender"],
  foodSafety: ["owner", "manager", "chef", "bartender"],
  suppliers: ["owner", "manager", "chef"],
  // Everyone: kitchen and bar staff need the emergency numbers (113/114/115)
  // and building management during a shift with no manager on site. Editing
  // is still Owner/Manager only — see canEditContacts.
  contacts: ["owner", "manager", "chef", "bartender"],
  licensing: ["owner", "manager"],
  sales: ["owner", "manager"],
  staff: ["owner", "manager"],
  menu: ["owner", "manager"],
  marketing: ["owner", "manager"],
  shopping: ["owner", "manager"],
  deliveryPerformance: ["owner", "manager"],
  usageVariance: ["owner", "manager"],
};

export function canAccessModule(role: Role, module: ModuleId): boolean {
  return MODULE_ACCESS[module].includes(role);
}

/** Recipe book: owner/manager can edit; chef can flag for review; bartender is read-only. */
export function canEditRecipes(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canFlagRecipes(role: Role): boolean {
  return role === "chef" || role === "owner" || role === "manager";
}

/** Stock: owner/manager see & edit both sections; chef edits kitchen; bartender edits bar. */
export function canEditStockSection(role: Role, section: StockSection): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role === "chef") return section === "kitchen";
  if (role === "bartender") return section === "bar";
  return false;
}

/** Bookings: owner/manager/bartender (FOH) can take and manage bookings; only owner/manager edit the floor plan itself. */
export function canEditFloorPlan(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/** Checklists: owner/manager edit templates for both areas; chef completes kitchen; bartender completes FOH. */
export function canEditChecklistTemplate(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canCompleteChecklistArea(role: Role, area: ChecklistArea): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role === "chef") return area === "kitchen";
  if (role === "bartender") return area === "foh";
  return false;
}

/** Production planner: chef can confirm/override quantities; owner/manager can too; bartender view-only (no access per module gate). */
export function canConfirmPlanner(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "chef";
}

/** Notice board: only owner/manager post; everyone can read & acknowledge. */
export function canPostNotice(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Food Safety Compliance Suite: kitchen-operational logs (temperature,
 * cooking, deliveries, cleaning, inspections, samples, pest) are entered by
 * Chef; the Customer Complaint log is entered by Bartender/FOH per the role
 * spec. Owner/Manager see and enter everything.
 */
const KITCHEN_FOOD_SAFETY_LOGS: FoodSafetyLogType[] = [
  "temperature",
  "cooking",
  "deliveries",
  "cleaning",
  "inspections",
  "samples",
  "pest",
];

export function visibleFoodSafetyLogs(role: Role): FoodSafetyLogType[] {
  if (role === "owner" || role === "manager") return [...KITCHEN_FOOD_SAFETY_LOGS, "complaints"];
  if (role === "chef") return KITCHEN_FOOD_SAFETY_LOGS;
  if (role === "bartender") return ["complaints"];
  return [];
}

export function canEnterFoodSafetyLog(role: Role, log: FoodSafetyLogType): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role === "chef") return KITCHEN_FOOD_SAFETY_LOGS.includes(log);
  if (role === "bartender") return log === "complaints";
  return false;
}

/** Supplier Management: rejections and formal periodic evaluations (continue/review/replace decisions) stay Owner/Manager only. */
export function canEditSuppliers(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Adding new suppliers, editing their contact/certification/document-checklist
 * details, and logging price quotes: Owner/Manager/Chef — chefs are often the
 * ones sourcing a new supplier or comparing prices day to day, so they need
 * to be able to add one and see how prices stack up, not just Owner/Manager.
 */
export function canManageSuppliers(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "chef";
}

/** Contacts Directory, Licensing Calendar: Owner/Manager only. */

export function canEditContacts(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canEditLicensing(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Cost & margin data (recipe cost-per-portion, stock unit costs): Owner
 * always sees it; Manager only once the Owner flips the visibility toggle in
 * Settings (default off) — this is the explicit "open question" the spec
 * asks to be built as a toggle rather than resolved either way.
 */
export function canSeeCostMargin(role: Role, settings: AppSettings): boolean {
  if (role === "owner") return true;
  if (role === "manager") return settings.managerSeesCostMargin;
  return false;
}

/** Daily Sales Entry: Owner/Manager only — module gate covers this, no extra restriction. */

/**
 * Staff module: Owner/Manager both have the module, but wages are
 * Owner-only by default (no toggle — the spec only asks for a toggle on
 * cost/margin, wages stays fixed). Hiring/candidate data and the
 * disciplinary log are Owner+Manager, which the module gate already covers.
 */
export function canSeeWages(role: Role): boolean {
  return role === "owner";
}

export function canEditStaff(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/** Menu & Pricing, Marketing Calendar: Owner/Manager only — module gate covers this. */
export function canEditMenu(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canEditMarketing(role: Role): boolean {
  return role === "owner" || role === "manager";
}
