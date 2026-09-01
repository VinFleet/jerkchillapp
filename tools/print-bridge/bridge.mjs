#!/usr/bin/env node
/**
 * The print bridge — the piece that stands where Sapo's native app stands.
 *
 * A web app cannot open a socket to a thermal printer, so this small process
 * runs on any machine inside the restaurant that stays on (a laptop, a mini
 * PC, a Raspberry Pi), claims jobs from the print_jobs queue in Supabase, and
 * speaks ESC/POS to the printers over the LAN on port 9100.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node tools/print-bridge/bridge.mjs
 *
 * Printers are configured IN THE APP (Settings -> Printing) and read from
 * the shared store, so changing an IP never means touching this machine.
 * printers.json next to this file is the fallback for a store that has no
 * saved settings yet:
 *   { "kitchen": { "host": "192.168.1.50", "width": 42 },
 *     "receipt": { "host": "192.168.1.51", "width": 42 } }
 *
 * Jobs older than 15 minutes are marked failed rather than printed: a bridge
 * switched on after lunch must not replay the whole morning onto the pass.
 */
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderKitchenTicket, renderReceipt } from "./escpos.mjs";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
let fallbackPrinters = {};
try {
  fallbackPrinters = JSON.parse(readFileSync(join(here, "printers.json"), "utf8"));
} catch {
  // Fine — the app's own settings are the real source.
}

let printers = fallbackPrinters;
let lastConfigFetch = 0;
const CONFIG_REFRESH_MS = 15000;

/**
 * The app's printer settings, from the shared store.
 *
 * Cached and refreshed on a slow cycle, and a fetch failure keeps the last
 * good copy — a Supabase blip must not turn into "the bridge forgot where
 * the printers are" mid-service.
 */
async function refreshPrinters() {
  if (Date.now() - lastConfigFetch < CONFIG_REFRESH_MS) return;
  lastConfigFetch = Date.now();
  try {
    const rows = await rest(
      "GET",
      `synced_records?collection=eq.printer_settings&record_id=eq.printers&select=data&limit=1`
    );
    const saved = rows?.[0]?.data;
    if (saved?.printers?.length) {
      const next = {};
      for (const p of saved.printers) {
        if (p.enabled !== false && p.host) next[p.key] = { host: p.host, width: p.width ?? 42 };
      }
      if (Object.keys(next).length) {
        const summary = Object.entries(next).map(([k, v]) => `${k}=${v.host}`).join(", ");
        const before = Object.entries(printers).map(([k, v]) => `${k}=${v.host}`).join(", ");
        if (summary !== before) console.log(`printer config from app: ${summary}`);
        printers = next;
      }
    }
  } catch (err) {
    console.error(`could not refresh printer config, keeping last known: ${err?.message ?? err}`);
  }
}

const POLL_MS = 3000;
const STALE_MINUTES = 15;
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(method, path, body) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Send bytes to a printer and wait for the socket to drain. */
function printTo(host, bytes, port = 9100) {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host, port, timeout: 5000 });
    sock.on("error", reject);
    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error(`printer ${host}:${port} timed out`));
    });
    sock.on("connect", () => {
      sock.end(Buffer.from(bytes), () => resolve(undefined));
    });
  });
}

async function claimNext() {
  // Claim by compare-and-swap on status, so two bridges started by accident
  // do not both print the same ticket.
  const rows = await rest(
    "GET",
    `print_jobs?status=eq.queued&order=created_at.asc&limit=1&select=*`
  );
  if (!rows?.length) return null;
  const job = rows[0];
  const claimed = await rest(
    "PATCH",
    `print_jobs?id=eq.${job.id}&status=eq.queued`,
    { status: "printing", claimed_at: new Date().toISOString() }
  );
  return claimed?.length ? claimed[0] : null; // someone else got there first
}

async function finish(id, ok, error) {
  await rest("PATCH", `print_jobs?id=eq.${id}`, {
    status: ok ? "done" : "failed",
    error: error ?? null,
    done_at: new Date().toISOString(),
  });
}

async function tick() {
  await refreshPrinters();
  const job = await claimNext();
  if (!job) return;

  const ageMinutes = (Date.now() - new Date(job.created_at).getTime()) / 60000;
  if (ageMinutes > STALE_MINUTES) {
    await finish(job.id, false, `stale: ${Math.round(ageMinutes)} minutes old, not replayed`);
    console.log(`skipped stale ${job.printer} job ${job.id}`);
    return;
  }

  const printer = printers[job.printer];
  if (!printer) {
    await finish(job.id, false, `no "${job.printer}" printer in printers.json`);
    return;
  }

  try {
    const bytes =
      job.printer === "kitchen"
        ? renderKitchenTicket(job.payload, printer.width ?? 42)
        : renderReceipt(job.payload, printer.width ?? 42);
    await printTo(printer.host, bytes, printer.port ?? 9100);
    await finish(job.id, true);
    console.log(`printed ${job.printer} job ${job.id} -> ${printer.host}`);
  } catch (err) {
    await finish(job.id, false, String(err?.message ?? err));
    console.error(`FAILED ${job.printer} job ${job.id}: ${err?.message ?? err}`);
  }
}

console.log(`print bridge up — watching ${URL_} every ${POLL_MS / 1000}s`);
console.log(`printers: ${Object.entries(printers).map(([k, v]) => `${k}=${v.host}`).join(", ")}`);

// eslint-disable-next-line no-constant-condition
while (true) {
  try {
    await tick();
  } catch (err) {
    // A dropped connection must not kill the bridge mid-service; the next
    // poll retries. The error is printed because silence hides a dead queue.
    console.error(`poll error: ${err?.message ?? err}`);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
