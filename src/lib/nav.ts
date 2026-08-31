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
export const MOBILE_PRIMARY_MODULES: ModuleId[] = ["checklists", "stock", "notices", "recipes"];
