"use client";

import { Check, X } from "lucide-react";
import type { Bi as BiValue } from "@/lib/types";

/**
 * An explicit yes/no answer for a check that goes into a legal record.
 *
 * Replaces a plain checkbox, because an unticked box is ambiguous: it looks
 * identical whether the person judged it a fail or simply hasn't answered
 * yet. That ambiguity was filing inspections as "Fail" and good deliveries as
 * "Rejected" whenever someone filled the text fields and hit save — the
 * failure state was the default state of the happy path.
 *
 * `value` of undefined means unanswered, and callers must refuse to save
 * until every check has a real answer.
 */
export function PassFail({
  label,
  value,
  onChange,
  passLabel = { en: "OK", vi: "Đạt" },
  failLabel = { en: "Not OK", vi: "Không đạt" },
}: {
  label: BiValue;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  passLabel?: BiValue;
  failLabel?: BiValue;
}) {
  const base = "flex-1 min-h-12 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-1.5";

  return (
    <div>
      <p className="text-sm font-medium mb-1.5">
        {label.en} <span className="text-muted">· {label.vi}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={value === true}
          className={`${base} ${
            value === true ? "bg-success text-white border-success" : "border-border text-muted"
          }`}
        >
          <Check size={16} /> {passLabel.en} · {passLabel.vi}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={value === false}
          className={`${base} ${
            value === false ? "bg-danger text-white border-danger" : "border-border text-muted"
          }`}
        >
          <X size={16} /> {failLabel.en} · {failLabel.vi}
        </button>
      </div>
    </div>
  );
}
