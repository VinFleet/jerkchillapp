import type { Bi as BiValue } from "@/lib/types";

/**
 * Renders English + Vietnamese together, always on, equal visual weight —
 * per spec this is not a language toggle. `stack` (default) puts VI on its
 * own line below EN; `inline` puts VI in parentheses on the same line for
 * tight spaces like table cells and chips.
 */
export function Bi({
  value,
  className = "",
  viClassName = "",
  mode = "stack",
}: {
  value: BiValue;
  className?: string;
  viClassName?: string;
  mode?: "stack" | "inline";
}) {
  if (mode === "inline") {
    return (
      <span className={className}>
        {value.en} <span className={`text-muted ${viClassName}`}>· {value.vi}</span>
      </span>
    );
  }

  return (
    <span className={`flex flex-col ${className}`}>
      <span>{value.en}</span>
      <span className={`opacity-80 ${viClassName}`}>{value.vi}</span>
    </span>
  );
}
