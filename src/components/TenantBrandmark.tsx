"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { VinposWordmark } from "@/components/VinposWordmark";

/**
 * Whichever brand actually owns this screen.
 *
 * Jerk & Chill sees its own logo exactly as before; a new branch shows its
 * own name the moment the owner types one in, and the product mark only
 * until then. VINPOS is the platform, not the sign over anyone's door — so
 * anything a branch might print and hand a customer or a new hire (a bill,
 * a recipe book) has to wear THEIR name, never ours.
 */
export function TenantBrandmark({ compact = false }: { compact?: boolean }) {
  const [brand, setBrand] = useState<{ name: string; logoUrl?: string } | null>(null);
  useEffect(() => {
    const r = getReceiptSettings();
    setBrand({ name: r.headerName, logoUrl: r.logoUrl });
  }, []);
  if (!brand) return <VinposWordmark />;
  if (brand.logoUrl) {
    return (
      <Image
        src={brand.logoUrl}
        alt={brand.name || "logo"}
        width={compact ? 100 : 140}
        height={compact ? 71 : 99}
        priority
        className="shrink-0 w-auto"
        style={{ maxHeight: compact ? 44 : 64 }}
      />
    );
  }
  if (brand.name) {
    return <span className="font-black text-lg tracking-tight truncate">{brand.name}</span>;
  }
  return <VinposWordmark />;
}
