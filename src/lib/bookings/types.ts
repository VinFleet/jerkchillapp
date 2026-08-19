// Types for the booking module only. Kept separate from src/lib/types.ts
// deliberately — everything in that file is local-first (localStorage);
// everything here is backed by Supabase (shared with the public website).

export type TableShape = "square" | "round" | "rect";

export const TABLE_SHAPES: TableShape[] = ["square", "round", "rect"];

export type RestaurantTable = {
  id: string;
  tenant_id: string;
  table_number: string;
  seats: number;
  /**
   * Floor-plan position, stored as a fraction of the room (0–1) measured from
   * the top-left of the floor-plan canvas — deliberately not pixels, so one
   * saved layout renders the same on a phone, the kitchen tablet and a laptop.
   * A table that has never been placed sits at exactly (0, 0); the floor plan
   * auto-arranges those into a grid until someone drags them. Dragging clamps
   * inside `POS_MIN`/`POS_MAX`, so a dragged table never lands back on (0, 0)
   * and can never be lost off the edge of the canvas.
   */
  pos_x: number;
  pos_y: number;
  shape: TableShape;
  active: boolean;
};

/** Drag clamp — keeps a table fully inside the canvas and away from the "never placed" (0,0) sentinel. */
export const POS_MIN = 0.06;
export const POS_MAX = 0.94;

/** A table sitting on the schema default has never been placed by a human. */
export function isUnplaced(table: Pick<RestaurantTable, "pos_x" | "pos_y">): boolean {
  return table.pos_x === 0 && table.pos_y === 0;
}

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
