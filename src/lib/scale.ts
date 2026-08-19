export function scaleQty(qty: number, basePortions: number, targetPortions: number): number {
  if (basePortions <= 0) return qty;
  const scaled = (qty * targetPortions) / basePortions;
  return Math.round(scaled * 100) / 100;
}

export function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
