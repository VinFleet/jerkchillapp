"use client";

import { StaffAuthProvider } from "@/lib/bookings/StaffAuthContext";
import { StaffLoginGate } from "@/lib/bookings/StaffLoginGate";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffAuthProvider>
      <StaffLoginGate>{children}</StaffLoginGate>
    </StaffAuthProvider>
  );
}
