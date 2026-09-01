/**
 * The product's name, as a wordmark.
 *
 * Text rather than an image on purpose: the restaurants using this each have
 * their own logo, and the product mark has to sit quietly beside any of them.
 * "VIN" carries the brand weight, "POS" says what it is.
 */
export function VinposWordmark({ size = "base" }: { size?: "base" | "lg" }) {
  return (
    <span
      className={`font-black tracking-tight select-none ${size === "lg" ? "text-3xl" : "text-xl"}`}
    >
      <span className="text-brand">VIN</span>
      <span className="text-foreground">POS</span>
    </span>
  );
}
