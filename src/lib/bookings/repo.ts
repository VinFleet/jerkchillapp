import { supabase } from "@/lib/supabase/client";
import { TENANT_ID } from "@/lib/bookings/types";
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
  const { error } = await requireClient()
    .from("bookings")
    .insert({ ...input, tenant_id: TENANT_ID, source: "online", duration_minutes: input.duration_minutes ?? 90 });
  if (error) throw error;
}
