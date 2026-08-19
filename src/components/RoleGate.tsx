"use client";

import { ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth/RoleContext";
import { canAccessModule, type ModuleId } from "@/lib/auth/permissions";

export function RoleGate({ module, children }: { module: ModuleId; children: React.ReactNode }) {
  const { session } = useSession();
  if (!session) return null;

  if (!canAccessModule(session.role, module)) {
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
