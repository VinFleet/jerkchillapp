"use client";

import { useState } from "react";
import { Lock, Delete } from "lucide-react";
import { verifyPin, isHashedPin } from "@/lib/auth/pin";
import { rehashStaffPin } from "@/lib/repo/staff";
import type { StaffMember } from "@/lib/types";

/**
 * A 4-digit check for actions that are personally someone's — acknowledging
 * the Code of Conduct, opening their own record.
 *
 * Everything else on a shared station is attributed by picking a name, which
 * is fine for "who counted the stock". It is not fine for "I have read and
 * accept this policy", where one person tapping on another's behalf makes the
 * record worthless.
 *
 * Deliberately a keypad, not a text field: no keyboard on a wet-handed
 * tablet, and big targets. This is an accountability check, not a security
 * boundary — the device already holds the restaurant's session.
 */
export function PinGate({
  member,
  title,
  onVerified,
  onCancel,
}: {
  member: StaffMember;
  title: { en: string; vi: string };
  onVerified: () => void;
  onCancel: () => void;
}) {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  const noPinSet = !member.pin;

  const press = (digit: string) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setError(false);
    if (next.length === 4) {
      void verifyPin(next, member.pin).then((ok) => {
        if (ok) {
          // A plaintext PIN that just proved itself is upgraded on the spot —
          // the only moment the digits are legitimately in hand.
          if (!isHashedPin(member.pin)) void rehashStaffPin(member.id, next);
          onVerified();
        } else {
          setError(true);
          setTimeout(() => setEntered(""), 600);
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div
        className="bg-surface w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl p-5 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Lock size={17} className="text-brand shrink-0" />
          <p className="font-bold text-sm">{title.en}</p>
        </div>
        <p className="text-xs text-muted mb-1">{title.vi}</p>
        <p className="text-sm font-semibold mb-4">{member.name}</p>

        {noPinSet ? (
          <>
            <p className="text-sm text-warning font-semibold">
              No PIN set yet — ask the manager to add one on your staff record.
            </p>
            <p className="text-xs text-warning/80 mt-1">
              Chưa có mã PIN — nhờ quản lý thêm vào hồ sơ nhân viên của bạn.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-5" aria-label="PIN entry">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 ${
                    error
                      ? "border-danger bg-danger"
                      : entered.length > i
                        ? "border-brand bg-brand"
                        : "border-border"
                  }`}
                />
              ))}
            </div>
            {error && (
              <p className="text-xs text-danger font-semibold text-center mb-3">
                Wrong PIN · Sai mã PIN
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  className="min-h-14 rounded-2xl border-2 border-border text-xl font-bold tabular-nums active:bg-brand-light"
                >
                  {d}
                </button>
              ))}
              <span />
              <button
                onClick={() => press("0")}
                className="min-h-14 rounded-2xl border-2 border-border text-xl font-bold tabular-nums active:bg-brand-light"
              >
                0
              </button>
              <button
                onClick={() => {
                  setEntered((v) => v.slice(0, -1));
                  setError(false);
                }}
                className="min-h-14 rounded-2xl border-2 border-border flex items-center justify-center text-muted"
                aria-label="Delete · Xóa"
              >
                <Delete size={20} />
              </button>
            </div>
          </>
        )}

        <button
          onClick={onCancel}
          className="w-full min-h-12 mt-4 rounded-2xl border-2 border-border font-semibold text-sm text-muted"
        >
          Cancel · Hủy
        </button>
      </div>
    </div>
  );
}
