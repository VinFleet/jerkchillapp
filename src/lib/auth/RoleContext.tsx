"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, Station, Role, StaffMember } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";

const SESSION_KEY = "jc_session";

/**
 * A station's permissions. Derived from where the device is, never picked from
 * a menu — previously anyone could tap "Manager" and type a name, which meant
 * a bartender could give themselves supplier, pricing and staff access.
 *
 * Manager and Owner are the same person here, so the manager station carries
 * owner permissions rather than the reduced manager set.
 */
export const STATION_ROLE: Record<Station, Role> = {
  kitchen: "chef",
  foh: "bartender",
  manager: "owner",
};

export const STATION_LABEL: Record<Station, { en: string; vi: string }> = {
  kitchen: { en: "Kitchen", vi: "Bếp" },
  foh: { en: "Front of house", vi: "Phục vụ" },
  manager: { en: "Manager / Owner", vi: "Quản lý / Chủ" },
};

/** Which staff roles normally work a given station, for the "who's working" picker. */
export function staffFitsStation(member: StaffMember, station: Station): boolean {
  if (station === "manager") return true;
  const role = member.role.toLowerCase();
  if (station === "kitchen") return role.includes("chef") || role.includes("kitchen") || role.includes("bếp");
  return role.includes("foh") || role.includes("bar") || role.includes("service") || role.includes("phục vụ");
}

type RoleContextValue = {
  session: Session | null;
  ready: boolean;
  /** Sign the device in to a station. Happens once, not per person. */
  signInStation: (station: Station) => void;
  /** Change who is working at this station — one tap, no sign-out. */
  setActiveStaff: (member: StaffMember | null) => void;
  logout: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Session> & { role?: Role; name?: string };
        // Sessions written before stations existed carried only a role and a
        // typed name. Map them onto the nearest station so nobody is thrown
        // back to the login screen mid-shift by an update.
        if (!parsed.station && parsed.role) {
          const station: Station =
            parsed.role === "chef" ? "kitchen" : parsed.role === "bartender" ? "foh" : "manager";
          setSession({
            station,
            role: STATION_ROLE[station],
            name: parsed.name ?? "",
            activeStaffId: null,
          });
        } else if (parsed.station) {
          setSession(parsed as Session);
        }
      }
    } catch {
      // ignore corrupt session
    }
    setReady(true);
  }, []);

  const persist = (next: Session | null) => {
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
    setSession(next);
  };

  const signInStation = useCallback((station: Station) => {
    persist({ station, role: STATION_ROLE[station], name: "", activeStaffId: null });
  }, []);

  const setActiveStaff = useCallback(
    (member: StaffMember | null) => {
      setSession((current) => {
        if (!current) return current;
        const next: Session = {
          ...current,
          name: member?.name ?? "",
          activeStaffId: member?.id ?? null,
        };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const logout = useCallback(() => {
    // The manager station is backed by a real Supabase login — clear that too,
    // or the device could silently regain owner access without a password
    // (supabase-js persists its own session separately from jc_session).
    if (session?.station === "manager" && supabase) {
      supabase.auth.signOut();
    }
    persist(null);
  }, [session?.station]);

  return (
    <RoleContext.Provider value={{ session, ready, signInStation, setActiveStaff, logout }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useSession must be used within RoleProvider");
  return ctx;
}
