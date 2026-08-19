"use client";

import { ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth/RoleContext";
import { visibleFoodSafetyLogs } from "@/lib/auth/permissions";
import type { FoodSafetyLogType } from "@/lib/types";

export function FoodSafetyLogGate({ log, children }: { log: FoodSafetyLogType; children: React.ReactNode }) {
  const { session } = useSession();
  if (!session) return null;

  if (!visibleFoodSafetyLogs(session.role).includes(log)) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }

  return <>{children}</>;
}
