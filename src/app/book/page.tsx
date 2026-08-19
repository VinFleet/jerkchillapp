"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { supabaseConfigured } from "@/lib/supabase/client";
import { getPublicTables, getPublicAvailability, createPublicBooking } from "@/lib/bookings/repo";

function todayIso(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

const TIME_SLOTS = ["11:30", "12:00", "12:30", "13:00", "13:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function NotConfigured() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 text-center">
      <p className="text-muted">
        Booking isn&apos;t set up yet. Please call the restaurant directly.
        <br />
        <span className="opacity-80">Đặt bàn online chưa sẵn sàng. Vui lòng gọi trực tiếp cho nhà hàng.</span>
      </p>
    </div>
  );
}

export default function PublicBookingPage() {
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("19:00");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [allergies, setAllergies] = useState("");
  const [checking, setChecking] = useState(false);
  const [likelyAvailable, setLikelyAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabaseConfigured) return <NotConfigured />;

  const checkAvailability = async () => {
    setChecking(true);
    setLikelyAvailable(null);
    try {
      const [tables, existing] = await Promise.all([getPublicTables(), getPublicAvailability(date)]);
      const reqStart = toMinutes(time);
      const fits = tables.some((t) => {
        if (t.seats < partySize) return false;
        const clash = existing.some(
          (b) => b.table_id === t.id && overlaps(reqStart, 90, toMinutes(b.booking_time.slice(0, 5)), b.duration_minutes)
        );
        return !clash;
      });
      setLikelyAvailable(fits);
    } catch {
      setLikelyAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createPublicBooking({
        table_id: null,
        booking_date: date,
        booking_time: time,
        party_size: partySize,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        special_requests: requests.trim() || undefined,
        allergies: allergies.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      // Never surface the raw Supabase/Postgres error to a guest — it's
      // English-only, technical, and can leak schema detail. Guests get one
      // fixed bilingual message; the real error stays in the console for us.
      console.error("Public booking failed:", e);
      setError(
        "Sorry, we couldn't send that. Please call us instead · Xin lỗi, không gửi được. Vui lòng gọi cho chúng tôi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 safe-top safe-bottom text-center"
        style={{ backgroundColor: "var(--brand)" }}
      >
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full">
          <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
          <h1 className="font-bold text-lg mb-1">Booking requested!</h1>
          <p className="text-muted text-sm mb-1">Đã gửi yêu cầu đặt bàn!</p>
          <p className="text-sm mt-4">
            {name} · {date} at {time} · {partySize} {partySize > 1 ? "people" : "person"}
          </p>
          <p className="text-muted text-xs mt-4">
            We&apos;ll confirm by phone if anything needs adjusting. Chúng tôi sẽ gọi xác nhận nếu cần điều chỉnh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh px-4 py-8 safe-top safe-bottom"
      style={{
        backgroundColor: "var(--brand)",
        backgroundImage: "url('/brand/pattern-800.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "220px",
      }}
    >
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex justify-center mb-5">
            <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={180} height={128} priority />
          </div>
          <h1 className="text-center font-bold text-lg mb-1">Book a table</h1>
          <p className="text-center text-muted text-sm mb-6">Đặt bàn</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Date · Ngày</label>
              <input
                type="date"
                min={todayIso()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setLikelyAvailable(null);
                }}
                className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Time · Giờ</label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTime(t);
                      setLikelyAvailable(null);
                    }}
                    className={`min-h-11 rounded-xl text-sm font-semibold border-2 ${
                      time === t ? "bg-brand text-white border-brand" : "border-border text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Party size · Số người</label>
              <Stepper
                value={partySize}
                onChange={(v) => {
                  setPartySize(v);
                  setLikelyAvailable(null);
                }}
                min={1}
              />
            </div>

            {likelyAvailable === null ? (
              <Button variant="secondary" className="w-full" disabled={checking} onClick={checkAvailability}>
                {checking ? "Checking… · Đang kiểm tra…" : "Check availability · Kiểm tra chỗ trống"}
              </Button>
            ) : likelyAvailable ? (
              <p className="text-sm text-success font-semibold text-center">
                Looks available · Có vẻ còn chỗ
              </p>
            ) : (
              <p className="text-sm text-warning font-semibold text-center">
                We may be full at this time, but send it anyway — we&apos;ll call you · Có thể đã kín chỗ, cứ gửi và chúng tôi sẽ gọi lại
              </p>
            )}

            <div className="pt-2 border-t border-border space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name · Tên của bạn"
                className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number · Số điện thoại"
                className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base"
              />
              <input
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                placeholder="Special requests (optional) · Yêu cầu đặc biệt"
                className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base"
              />
              <input
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Allergies (optional) · Dị ứng"
                className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base"
              />
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button className="w-full" disabled={!name.trim() || !phone.trim() || submitting} onClick={submit}>
              {submitting ? "Sending… · Đang gửi…" : "Request booking · Gửi yêu cầu đặt bàn"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
