import { supabase } from "@/lib/supabase/client";
import { raiseAlert } from "@/lib/push/alert";
import { TENANT_ID, POS_MIN, POS_MAX } from "@/lib/bookings/types";
import type { RestaurantTable, Booking, BookingStatus, TableShape } from "@/lib/bookings/types";

function requireClient() {
  if (!supabase) throw new Error("Booking isn't connected yet — Supabase isn't configured.");
  return supabase;
}

// ---------- Tables (floor plan) ----------

export async function getTables(): Promise<RestaurantTable[]> {
  const { data, error } = await requireClient()
    .from("restaurant_tables")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("active", true)
    .order("table_number");
  if (error) throw error;
  return data as RestaurantTable[];
}

export async function addTable(tableNumber: string, seats: number, posX: number, posY: number, shape: TableShape): Promise<RestaurantTable> {
  const { data, error } = await requireClient()
    .from("restaurant_tables")
    .insert({ tenant_id: TENANT_ID, table_number: tableNumber, seats, pos_x: posX, pos_y: posY, shape })
    .select()
    .single();
  if (error) throw error;
  return data as RestaurantTable;
}

export async function updateTable(id: string, patch: Partial<Pick<RestaurantTable, "table_number" | "seats" | "pos_x" | "pos_y" | "shape" | "active">>) {
  const { error } = await requireClient().from("restaurant_tables").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeTable(id: string) {
  const { error } = await requireClient().from("restaurant_tables").update({ active: false }).eq("id", id);
  if (error) throw error;
}

function clampPos(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(POS_MAX, Math.max(POS_MIN, n));
}

/** Persist a dragged table. Clamping lives here so every caller stays inside the canvas. */
export async function moveTable(id: string, posX: number, posY: number) {
  await updateTable(id, { pos_x: clampPos(posX), pos_y: clampPos(posY) });
}

type StarterTable = Pick<RestaurantTable, "table_number" | "seats" | "pos_x" | "pos_y" | "shape">;

/**
 * A plausible 26-seat starting layout — 4 × 2-top + 3 × 4-top + 1 × 6-top.
 * Offered as a one-tap action when the floor plan is empty, never created
 * silently: the real room layout is the owner's call, and until at least one
 * table exists the public booking form tells every guest "we may be full."
 */
export const STARTER_FLOOR_PLAN: StarterTable[] = [
  { table_number: "1", seats: 2, pos_x: 0.14, pos_y: 0.16, shape: "round" },
  { table_number: "2", seats: 2, pos_x: 0.14, pos_y: 0.39, shape: "round" },
  { table_number: "3", seats: 2, pos_x: 0.14, pos_y: 0.62, shape: "round" },
  { table_number: "4", seats: 2, pos_x: 0.14, pos_y: 0.85, shape: "round" },
  { table_number: "5", seats: 4, pos_x: 0.47, pos_y: 0.22, shape: "square" },
  { table_number: "6", seats: 4, pos_x: 0.47, pos_y: 0.5, shape: "square" },
  { table_number: "7", seats: 4, pos_x: 0.47, pos_y: 0.78, shape: "square" },
  { table_number: "8", seats: 6, pos_x: 0.81, pos_y: 0.36, shape: "rect" },
];

/** Creates the starter layout. No-ops if any table already exists — never overwrites a real floor plan. */
export async function createStarterFloorPlan(): Promise<RestaurantTable[]> {
  const existing = await getTables();
  if (existing.length > 0) return existing;
  const { data, error } = await requireClient()
    .from("restaurant_tables")
    .insert(STARTER_FLOOR_PLAN.map((t) => ({ ...t, tenant_id: TENANT_ID })))
    .select();
  if (error) throw error;
  return data as RestaurantTable[];
}

// ---------- Bookings (staff — full data, requires authenticated session) ----------

export async function getBookingsForDate(date: string): Promise<Booking[]> {
  const { data, error } = await requireClient()
    .from("bookings")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("booking_date", date)
    .neq("status", "cancelled")
    .order("booking_time");
  if (error) throw error;
  return data as Booking[];
}

/** Total confirmed/seated party size for a date — the hard, real-reservations part of "how many meals today." */
export async function getBookedCoversForDate(date: string): Promise<{ covers: number; bookingCount: number }> {
  const bookings = (await getBookingsForDate(date)).filter((b) => b.status === "confirmed" || b.status === "seated");
  return {
    covers: bookings.reduce((sum, b) => sum + b.party_size, 0),
    bookingCount: bookings.length,
  };
}

export type NewBookingInput = {
  table_id: string | null;
  booking_date: string;
  booking_time: string;
  party_size: number;
  duration_minutes?: number;
  customer_name: string;
  customer_phone: string;
  special_requests?: string;
  allergies?: string;
};

export async function createStaffBooking(input: NewBookingInput): Promise<Booking> {
  const { data, error } = await requireClient()
    .from("bookings")
    .insert({ ...input, tenant_id: TENANT_ID, source: "staff", duration_minutes: input.duration_minutes ?? 90 })
    .select()
    .single();
  if (error) throw error;
  return data as Booking;
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const { error } = await requireClient().from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
  // Cancellations are the ones that change what the kitchen preps and what the
  // floor expects, so they're worth telling people about; a confirmation isn't.
  if (status === "cancelled" || status === "no_show") {
    raiseAlert({
      category: "bookings",
      title: { en: "Booking cancelled", vi: "Đặt bàn đã hủy" },
      body: {
        en: "A booking was cancelled — check the covers for tonight.",
        vi: "Một đặt bàn đã hủy — kiểm tra lại số khách tối nay.",
      },
      url: "/bookings",
    });
  }
}

export async function updateBooking(id: string, patch: Partial<NewBookingInput>) {
  const { error } = await requireClient().from("bookings").update(patch).eq("id", id);
  if (error) throw error;
}

/** Live updates so an online booking shows up on the tablet without a refresh. */
export function subscribeToBookings(date: string, onChange: () => void): () => void {
  const client = requireClient();
  const channel = client
    .channel(`bookings-${date}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `booking_date=eq.${date}` }, onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

// ---------- Public (website — no auth, restricted by RLS) ----------

export async function getPublicTables(): Promise<RestaurantTable[]> {
  const { data, error } = await requireClient()
    .from("restaurant_tables")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("active", true);
  if (error) throw error;
  return data as RestaurantTable[];
}

export type AvailabilityRow = {
  id: string;
  table_id: string | null;
  booking_date: string;
  booking_time: string;
  party_size: number;
  duration_minutes: number;
  status: BookingStatus;
};

export async function getPublicAvailability(date: string): Promise<AvailabilityRow[]> {
  const { data, error } = await requireClient()
    .from("booking_availability")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("booking_date", date);
  if (error) throw error;
  return data as AvailabilityRow[];
}

export async function createPublicBooking(input: NewBookingInput): Promise<void> {
  const { data, error } = await requireClient()
    .from("bookings")
    .insert({ ...input, tenant_id: TENANT_ID, source: "online", duration_minutes: input.duration_minutes ?? 90 })
    .select("id")
    .single();
  if (error) throw error;

  // The booking is saved at this point. Confirming it over Zalo is a courtesy
  // on top, so it is deliberately not awaited and never rethrows — a guest
  // whose confirmation fails still has a table, and must not be shown an error
  // suggesting otherwise. The route answers "skipped" when Zalo isn't set up,
  // which is the normal case until the Official Account exists.
  void notifyGuestOverZalo({
    bookingRef: (data as { id: string }).id,
    phone: input.customer_phone,
    guestName: input.customer_name,
    bookingTime: `${input.booking_time.slice(0, 5)} ${formatDateForGuest(input.booking_date)}`,
    partySize: input.party_size,
  });
}

/** "2026-08-20" -> "20/08/2026", the format Zalo templates expect. */
function formatDateForGuest(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function notifyGuestOverZalo(payload: {
  bookingRef: string;
  phone: string;
  guestName: string;
  bookingTime: string;
  partySize: number;
}): Promise<void> {
  try {
    await fetch("/api/zalo/booking-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Offline, blocked, or the route is unreachable — none of which should
    // surface to a guest who has already booked.
  }
}
