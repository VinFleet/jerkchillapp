import { supabase } from "@/lib/supabase/client";
import { getActiveTenant } from "@/lib/storage";
import { getPrinterSettings, printerFor } from "@/lib/repo/printerSettings";
import { nativePrintAvailable, nativePrintRaw } from "./native";
import { renderJobBytes, type PrinterStation } from "./jobs";

/**
 * The queue claimer that lets a restaurant not own a bridge machine.
 *
 * The native till prints its own sends directly, but jobs still land in the
 * cloud queue from everywhere else — a guest ordering by QR, a waiter's
 * phone on the web build, a failed direct write. Someone has to drain
 * those. This worker runs inside the native till app and does exactly what
 * tools/print-bridge/bridge.mjs does — claim by compare-and-swap, render,
 * print, mark done, refuse stale jobs, heartbeat — so the till IS the
 * bridge, and the machine in the corner becomes optional everywhere.
 *
 * Claiming uses the same CAS the bridge uses: an UPDATE guarded by
 * status='queued' can only win once, so a till app and a bridge process
 * running side by side never double-print — whoever loses the swap simply
 * finds no row.
 */

const POLL_MS = 4000;
const HEARTBEAT_MS = 15000;
const STALE_MINUTES = 15;

type ClaimedJob = {
  id: string;
  printer: string;
  payload: unknown;
  created_at: string;
};

async function finish(jobId: string, ok: boolean, error?: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("print_jobs")
    .update({
      status: ok ? "done" : "failed",
      error: error ?? null,
      done_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function claimNext(tenant: string): Promise<ClaimedJob | null> {
  if (!supabase) return null;
  const { data: oldest } = await supabase
    .from("print_jobs")
    .select("id")
    .eq("tenant_id", tenant)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!oldest) return null;

  const { data: claimed } = await supabase
    .from("print_jobs")
    .update({ status: "printing", claimed_at: new Date().toISOString() })
    .eq("id", oldest.id)
    .eq("status", "queued") // the CAS: only one claimer wins this row
    .select("id, printer, payload, created_at")
    .maybeSingle();
  return (claimed as ClaimedJob | null) ?? null;
}

async function heartbeat(tenant: string): Promise<void> {
  if (!supabase) return;
  const printers = Object.fromEntries(
    getPrinterSettings()
      .printers.filter((p) => p.enabled && p.host)
      .map((p) => [p.key, p.host])
  );
  await supabase
    .from("print_bridge_status")
    .upsert(
      { tenant_id: tenant, seen_at: new Date().toISOString(), printers },
      { onConflict: "tenant_id" }
    )
    .then(
      () => undefined,
      () => undefined
    );
}

async function tick(tenant: string): Promise<void> {
  const job = await claimNext(tenant);
  if (!job) return;

  const ageMinutes = (Date.now() - new Date(job.created_at).getTime()) / 60000;
  if (ageMinutes > STALE_MINUTES) {
    await finish(job.id, false, `stale: ${Math.round(ageMinutes)} minutes old, not replayed`);
    return;
  }

  const station = job.printer as PrinterStation;
  const config = printerFor(getPrinterSettings(), station);
  if (!config?.enabled || !config.host) {
    await finish(job.id, false, `no "${job.printer}" printer configured on the till`);
    return;
  }

  const printed = await nativePrintRaw(config.host, renderJobBytes(station, job.payload));
  await finish(job.id, printed, printed ? undefined : `could not reach ${config.host}:9100`);
}

/**
 * Start claiming, if this device can print. Returns a stop function; call
 * it on unmount so a backgrounded webview does not fight the next start.
 * Safe to call anywhere — on the web build it is a no-op.
 */
export function startTillPrintWorker(): () => void {
  if (!nativePrintAvailable() || !supabase) return () => undefined;

  const tenant = getActiveTenant();
  let stopped = false;
  let lastBeat = 0;

  const loop = async () => {
    if (stopped) return;
    try {
      if (Date.now() - lastBeat >= HEARTBEAT_MS) {
        lastBeat = Date.now();
        await heartbeat(tenant);
      }
      await tick(tenant);
    } catch {
      // A dropped connection must not kill the worker mid-service; the next
      // poll retries.
    }
    if (!stopped) window.setTimeout(() => void loop(), POLL_MS);
  };
  void loop();

  return () => {
    stopped = true;
  };
}
