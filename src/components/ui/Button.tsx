import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark disabled:opacity-40",
  secondary: "bg-brand-light text-brand active:bg-brand-tint disabled:opacity-40",
  ghost: "bg-transparent text-foreground border border-border active:bg-black/5 disabled:opacity-40",
  danger: "bg-danger text-white active:opacity-90 disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-14 px-5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
