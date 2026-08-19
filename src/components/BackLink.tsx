import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-brand text-sm font-semibold px-4 md:px-8 pt-4">
      <ChevronLeft size={18} /> {label}
    </Link>
  );
}
