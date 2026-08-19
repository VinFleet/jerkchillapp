"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";

const SESSION_KEY = "jc_session";

type RoleContextValue = {
  session: Session | null;
  ready: boolean;
  login: (session: Session) => void;
  logout: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignore corrupt session
    }
    setReady(true);
  }, []);

  const login = (next: Session) => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const logout = () => {
    // Owner sessions are backed by a real Supabase login — clear that too,
    // or the device could silently regain Owner access without a password
    // next time someone taps "Owner" (supabase-js persists its own session
    // separately from jc_session).
    if (session?.role === "owner" && supabase) {
      supabase.auth.signOut();
    }
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <RoleContext.Provider value={{ session, ready, login, logout }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useSession must be used within RoleProvider");
  return ctx;
}
