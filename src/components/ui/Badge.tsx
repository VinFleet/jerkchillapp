import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "muted" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  muted: "bg-black/5 text-muted",
  brand: "bg-brand-light text-brand",
};

export function Badge({ tone = "muted", className = "", children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
