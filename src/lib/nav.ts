import {
  Home,
  BookOpen,
  ClipboardList,
  CheckSquare,
  CalendarClock,
  Megaphone,
  ShieldCheck,
  Truck,
  Contact,
  BadgeCheck,
  Wallet,
  Users,
  UtensilsCrossed,
  Sparkle,
  ShoppingCart,
  Bike,
  Scale,
  CalendarDays,
  Receipt,
  ChefHat,
} from "lucide-react";
import { History, ShieldCheck as ShieldCheck2 } from "lucide-react";
import type { ModuleId } from "@/lib/auth/permissions";
import type { Bi } from "@/lib/types";

export type NavItem = {
  href: string;
  label: Bi;
  icon: typeof Home;
  module: ModuleId | "home";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: { en: "Home", vi: "Trang chủ" }, icon: Home, module: "home" },
  { href: "/recipes", label: { en: "Recipes", vi: "Công thức" }, icon: BookOpen, module: "recipes" },
  { href: "/stock", label: { en: "Stock", vi: "Tồn kho" }, icon: ClipboardList, module: "stock" },
  { href: "/checklists", label: { en: "Checklists", vi: "Danh sách" }, icon: CheckSquare, module: "checklists" },
  { href: "/planner", label: { en: "Planner", vi: "Kế hoạch" }, icon: CalendarClock, module: "planner" },
  { href: "/notices", label: { en: "Notices", vi: "Thông báo" }, icon: Megaphone, module: "notices" },
  { href: "/bookings", label: { en: "Bookings", vi: "Đặt Bàn" }, icon: CalendarDays, module: "bookings" },
  { href: "/service", label: { en: "Service", vi: "Phục Vụ" }, icon: Receipt, module: "orders" },
  { href: "/kitchen", label: { en: "Kitchen Pass", vi: "Bếp" }, icon: ChefHat, module: "orders" },
  { href: "/food-safety", label: { en: "Food Safety", vi: "An toàn TP" }, icon: ShieldCheck, module: "foodSafety" },
  { href: "/suppliers", label: { en: "Suppliers", vi: "Nhà cung cấp" }, icon: Truck, module: "suppliers" },
  { href: "/contacts", label: { en: "Contacts", vi: "Danh bạ" }, icon: Contact, module: "contacts" },
  { href: "/licensing", label: { en: "Licensing", vi: "Giấy phép" }, icon: BadgeCheck, module: "licensing" },
  { href: "/sales", label: { en: "Sales", vi: "Doanh thu" }, icon: Wallet, module: "sales" },
  { href: "/staff", label: { en: "Staff", vi: "Nhân viên" }, icon: Users, module: "staff" },
  { href: "/menu", label: { en: "Menu & Pricing", vi: "Thực đơn & Giá" }, icon: UtensilsCrossed, module: "menu" },
  { href: "/marketing", label: { en: "Marketing", vi: "Marketing" }, icon: Sparkle, module: "marketing" },
  { href: "/shopping", label: { en: "Shopping List", vi: "Danh Sách Đặt Hàng" }, icon: ShoppingCart, module: "shopping" },
  { href: "/delivery-performance", label: { en: "Delivery Platforms", vi: "Nền Tảng Giao Hàng" }, icon: Bike, module: "deliveryPerformance" },
  { href: "/usage-variance", label: { en: "Usage Variance", vi: "Chênh Lệch Sử Dụng" }, icon: Scale, module: "usageVariance" },
];

/**
 * The mobile bottom bar only has room for a few big tap targets before they
 * stop being "big" — Home plus these three, then everything else (Planner,
 * Notices, Food Safety, Suppliers, Contacts, Licensing) lives behind the
 * "More" tab at /more. The desktop sidebar isn't space-constrained the same
 * way, so it always shows the full NAV_ITEMS list.
 */
// Notices sits here rather than behind "More": it replaces the group chat,
// and an operational message nobody walks past is a message nobody reads.
//
// The bar is per-station because the same four slots cannot serve both ends
// of the room. A waiter's most-used screen is the till and a chef's is the
// pass — burying either behind "More" makes the newest feature the hardest
// to reach, mid-shift, one-handed.
export const MOBILE_PRIMARY_MODULES: ModuleId[] = ["checklists", "stock", "notices", "recipes"];

export function mobilePrimaryModules(station: "kitchen" | "foh" | "manager"): ModuleId[] {
  switch (station) {
    case "kitchen":
      // The pass replaces recipes: recipes are read at prep, the pass is read
      // every minute of service, and prep-time reading survives a tap on More.
      return ["orders", "checklists", "stock", "notices"];
    case "foh":
    case "manager":
      return ["orders", "checklists", "stock", "notices"];
  }
}

/** Where the orders module lands for this station — the pad or the pass. */
export function ordersHref(station: "kitchen" | "foh" | "manager"): string {
  return station === "kitchen" ? "/kitchen" : "/service";
}

// ---------- The launcher ----------

/**
 * The tiles a person sees after signing in, grouped by the job they came to
 * do rather than by module name. "Why am I here" has about four answers in a
 * restaurant — serving, cooking, checking, and paperwork — and the launcher
 * is organised around exactly those, in the order that station cares.
 */
export type LaunchGroup = {
  id: "service" | "kitchen" | "checks" | "team" | "office";
  title: Bi;
  items: NavItem[];
};

export const LAUNCH_GROUPS: LaunchGroup[] = [
  {
    id: "service",
    title: { en: "Service", vi: "Phục vụ" },
    items: [
      { href: "/service", label: { en: "Till · Tables", vi: "Máy tính tiền" }, icon: Receipt, module: "orders" },
      { href: "/bookings", label: { en: "Bookings", vi: "Đặt bàn" }, icon: CalendarDays, module: "bookings" },
      { href: "/service/history", label: { en: "Closed orders", vi: "Đơn đã đóng" }, icon: History, module: "orders" },
    ],
  },
  {
    id: "kitchen",
    title: { en: "Kitchen", vi: "Bếp" },
    items: [
      { href: "/kitchen", label: { en: "Kitchen pass", vi: "Màn hình bếp" }, icon: ChefHat, module: "orders" },
      { href: "/recipes", label: { en: "Recipes", vi: "Công thức" }, icon: BookOpen, module: "recipes" },
      { href: "/planner", label: { en: "Prep planner", vi: "Kế hoạch" }, icon: CalendarClock, module: "planner" },
    ],
  },
  {
    id: "checks",
    title: { en: "Checks", vi: "Kiểm tra" },
    items: [
      { href: "/checklists", label: { en: "Open / close", vi: "Mở / đóng ca" }, icon: CheckSquare, module: "checklists" },
      { href: "/food-safety", label: { en: "Food safety", vi: "An toàn TP" }, icon: ShieldCheck2, module: "foodSafety" },
      { href: "/stock", label: { en: "Stock count", vi: "Tồn kho" }, icon: ClipboardList, module: "stock" },
    ],
  },
  {
    id: "team",
    title: { en: "Team", vi: "Đội ngũ" },
    items: [
      { href: "/notices", label: { en: "Notices", vi: "Thông báo" }, icon: Megaphone, module: "notices" },
      { href: "/contacts", label: { en: "Contacts", vi: "Danh bạ" }, icon: Contact, module: "contacts" },
    ],
  },
  {
    id: "office",
    title: { en: "Office", vi: "Văn phòng" },
    items: [
      { href: "/sales", label: { en: "Sales & cash-up", vi: "Doanh thu" }, icon: Wallet, module: "sales" },
      { href: "/menu", label: { en: "Menu & pricing", vi: "Thực đơn & giá" }, icon: UtensilsCrossed, module: "menu" },
      { href: "/staff", label: { en: "Staff", vi: "Nhân viên" }, icon: Users, module: "staff" },
      { href: "/suppliers", label: { en: "Suppliers", vi: "Nhà cung cấp" }, icon: Truck, module: "suppliers" },
      { href: "/shopping", label: { en: "Shopping list", vi: "Đặt hàng" }, icon: ShoppingCart, module: "shopping" },
      { href: "/marketing", label: { en: "Marketing", vi: "Marketing" }, icon: Sparkle, module: "marketing" },
      { href: "/licensing", label: { en: "Licensing", vi: "Giấy phép" }, icon: BadgeCheck, module: "licensing" },
      { href: "/delivery-performance", label: { en: "Delivery platforms", vi: "Nền tảng giao" }, icon: Bike, module: "deliveryPerformance" },
      { href: "/usage-variance", label: { en: "Usage variance", vi: "Chênh lệch" }, icon: Scale, module: "usageVariance" },
    ],
  },
];

/** Which job comes first depends on where you stand. */
export function launchOrder(station: "kitchen" | "foh" | "manager"): LaunchGroup["id"][] {
  switch (station) {
    case "kitchen":
      return ["kitchen", "checks", "service", "team", "office"];
    case "foh":
      return ["service", "checks", "kitchen", "team", "office"];
    case "manager":
      return ["service", "office", "kitchen", "checks", "team"];
  }
}
