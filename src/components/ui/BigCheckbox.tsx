"use client";

import { Check } from "lucide-react";
import type { Bi as BiValue } from "@/lib/types";
import { Bi } from "@/components/Bi";

export function BigCheckbox({
  label,
  checked,
  subtitle,
  onToggle,
  disabled,
}: {
  label: BiValue;
  checked: boolean;
  subtitle?: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-4 min-h-16 px-4 py-3 rounded-2xl border text-left transition-colors ${
        checked
          ? "bg-success-tint border-success/40"
          : "bg-surface border-border active:bg-black/5"
      } disabled:opacity-50`}
    >
      <span
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border-2 ${
          checked ? "bg-success border-success text-white" : "border-border text-transparent"
        }`}
      >
        <Check size={22} strokeWidth={3} />
      </span>
      <span className="flex-1">
        <Bi value={label} className={checked ? "line-through opacity-60" : ""} />
        {subtitle && <span className="block text-xs text-muted mt-1">{subtitle}</span>}
      </span>
    </button>
  );
}
