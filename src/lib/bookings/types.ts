// Types for the booking module only. Kept separate from src/lib/types.ts
// deliberately — everything in that file is local-first (localStorage);
// everything here is backed by Supabase (shared with the public website).

export type TableShape = "square" | "round" | "rect";

export type RestaurantTable = {
  id: string;
  tenant_id: string;
  table_number: string;
  seats: number;
  pos_x: number;
  pos_y: number;
  shape: TableShape;
  active: boolean;
};

export type BookingStatus = "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
export type BookingSource = "staff" | "online";

export type Booking = {
  id: string;
  tenant_id: string;
  table_id: string | null;
  booking_date: string;
  booking_time: string;
  party_size: number;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string;
  special_requests: string | null;
  allergies: string | null;
  status: BookingStatus;
  source: BookingSource;
  created_at: string;
  updated_at: string;
};

export const TENANT_ID = "jerk-and-chill-thao-dien";
