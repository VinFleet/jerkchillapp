import { Thermometer, Flame, Truck, Sparkles, ClipboardCheck, TestTube, Bug, MessageCircleWarning } from "lucide-react";
import type { FoodSafetyLogType, Bi } from "@/lib/types";

export const FOOD_SAFETY_LOG_LABEL: Record<FoodSafetyLogType, Bi> = {
  temperature: { en: "Fridge & Freezer Temp", vi: "Nhiệt Độ Tủ Lạnh & Tủ Đông" },
  cooking: { en: "Cooking / Core Temp", vi: "Nhiệt Độ Nấu / Lõi" },
  deliveries: { en: "Delivery / Receiving", vi: "Nhận Hàng" },
  cleaning: { en: "Cleaning Schedule", vi: "Lịch Vệ Sinh" },
  inspections: { en: "Three-Step Inspection", vi: "Kiểm Tra 3 Bước" },
  samples: { en: "Food Sample Retention", vi: "Lưu Mẫu Thức Ăn" },
  pest: { en: "Pest Control", vi: "Kiểm Soát Côn Trùng" },
  complaints: { en: "Customer Complaints", vi: "Khiếu Nại Khách Hàng" },
};

export const FOOD_SAFETY_LOG_ICON: Record<FoodSafetyLogType, typeof Thermometer> = {
  temperature: Thermometer,
  cooking: Flame,
  deliveries: Truck,
  cleaning: Sparkles,
  inspections: ClipboardCheck,
  samples: TestTube,
  pest: Bug,
  complaints: MessageCircleWarning,
};

export const FOOD_SAFETY_LOG_ORDER: FoodSafetyLogType[] = [
  "temperature",
  "cooking",
  "deliveries",
  "cleaning",
  "inspections",
  "samples",
  "pest",
  "complaints",
];
