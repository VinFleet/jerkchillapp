"use client";

import { Minus, Plus } from "lucide-react";

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  disabled,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "w-9 h-9" : "w-11 h-11";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(min, value - step))}
        className={`${btn} rounded-xl bg-brand-light text-brand flex items-center justify-center active:bg-brand-tint disabled:opacity-40 shrink-0`}
        aria-label="Decrease"
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-16 text-center font-bold tabular-nums bg-transparent border-b-2 border-border focus:outline-none focus:border-brand disabled:opacity-40"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + step)}
        className={`${btn} rounded-xl bg-brand-light text-brand flex items-center justify-center active:bg-brand-tint disabled:opacity-40 shrink-0`}
        aria-label="Increase"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
