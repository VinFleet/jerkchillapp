"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/RoleContext";

export default function RootPage() {
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(session ? "/home" : "/login");
  }, [ready, session, router]);

  return null;
}
