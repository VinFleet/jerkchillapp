export function scaleQty(qty: number, basePortions: number, targetPortions: number): number {
  if (basePortions <= 0) return qty;
  const scaled = (qty * targetPortions) / basePortions;
  const rounded = Math.round(scaled * 100) / 100;
  // A genuinely positive quantity must never round away to exactly zero — a
  // huge scale-down (a catering recipe taken to 1 portion) can leave a real
  // ingredient at, say, 0.004, and rounding to 2dp would print "0", which a
  // chef reads as "not needed," not "a trace amount." Keep the true tiny
  // value here so formatQty can say so honestly instead.
  if (scaled > 0 && rounded === 0) return scaled;
  return rounded;
}

export function formatQty(value: number): string {
  if (value > 0 && value < 0.01) return "<0.01";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
