import type { Role, Bi } from "@/lib/types";

export const ROLE_LABEL: Record<Role, Bi> = {
  owner: { en: "Owner", vi: "Chủ nhà hàng" },
  manager: { en: "Manager", vi: "Quản lý" },
  chef: { en: "Chef / Kitchen", vi: "Bếp trưởng / Bếp" },
  bartender: { en: "Bartender / FOH", vi: "Pha chế / Phục vụ" },
};

export const ROLE_ORDER: Role[] = ["owner", "manager", "chef", "bartender"];
