"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { startSync, onSyncStatus, onSyncedDataChanged, syncNow, type SyncStatus } from "@/lib/sync/engine";

type SyncValue = {
  status: SyncStatus;
  pendingCount: number;
  /** bumps whenever a pull brought in changes — use as a effect dep to re-read */
  dataVersion: number;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncValue>({
  status: "off",
  pendingCount: 0,
  dataVersion: 0,
  syncNow: async () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>("off");
  const [pendingCount, setPendingCount] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const stopStatus = onSyncStatus((s, pending) => {
      setStatus(s);
      setPendingCount(pending);
    });
    const stopData = onSyncedDataChanged(() => setDataVersion((v) => v + 1));
    const stopSync = startSync();
    return () => {
      stopStatus();
      stopData();
      stopSync();
    };
  }, []);

  const value: SyncValue = {
    status,
    pendingCount,
    dataVersion,
    syncNow: useCallback(() => syncNow(), []),
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  return useContext(SyncContext);
}

/**
 * Re-runs `reload` whenever synced data arrives from another device, so an
 * open screen updates itself instead of showing yesterday's answer until
 * someone thinks to refresh.
 */
export function useSyncedData(reload: () => void) {
  const { dataVersion } = useSync();
  useEffect(() => {
    reload();
    // reload is expected to be stable or cheap; dataVersion drives the re-read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);
}
