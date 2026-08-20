"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { shareText, shareResultMessage } from "@/lib/share";

/**
 * Sends something to the team's Zalo group (or anywhere else in the share
 * sheet). Labelled for Zalo specifically because that's where it's actually
 * going — "Share" alone doesn't tell a chef anything useful.
 */
export function ShareButton({
  title,
  buildText,
  label = { en: "Send to Zalo", vi: "Gửi qua Zalo" },
  className = "",
  variant = "secondary",
  disabled,
}: {
  /** subject line for the share sheet */
  title: string;
  /** built lazily so the text is current at the moment of tapping */
  buildText: () => string;
  label?: { en: string; vi: string };
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className={className}>
      <Button
        variant={variant}
        className="w-full min-h-12 text-sm"
        disabled={disabled}
        onClick={async () => {
          const result = await shareText(title, buildText());
          setNote(shareResultMessage(result));
          if (result === "copied") setTimeout(() => setNote(null), 4000);
        }}
      >
        <Share2 size={16} /> {label.en} · {label.vi}
      </Button>
      {note && <p className="text-xs text-muted mt-1 text-center">{note}</p>}
    </div>
  );
}
