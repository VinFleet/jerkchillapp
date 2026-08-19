"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@/lib/types";

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
