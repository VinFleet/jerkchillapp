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
import { renderKitchenTicket, renderReceipt } from "../../src/lib/print/escpos.mjs";

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

/**
 * Which branch this bridge serves. A bridge is a physical box in ONE
 * restaurant, and it must claim only that restaurant's jobs — the service
 * role can see every tenant's queue, so the scoping has to happen here.
 * Without it, the first ticket another restaurant enqueues prints in this
 * kitchen.
 */
const TENANT =
  process.env.BRIDGE_TENANT ??
  fallbackPrinters.tenant ??
  "jerk-and-chill-thao-dien";

// The tenant key is bridge identity, not a printer.
delete fallbackPrinters.tenant;

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
      `synced_records?tenant_id=eq.${encodeURIComponent(TENANT)}&collection=eq.printer_settings&record_id=eq.printers&select=data&limit=1`
    );
    const saved = rows?.[0]?.data;
    if (saved?.printers?.length) {
      const next = {};
      for (const p of saved.printers) {
        if (p.enabled !== false && p.host) {
          next[p.key] = {
            host: p.host,
            width: p.width ?? 42,
            encoding: p.encoding ?? "ascii",
            codepageByte: p.codepageByte,
          };
        }
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
    headers: { ...HEADERS, Prefer: "return=representation,resolution=merge-duplicates" },
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
    `print_jobs?status=eq.queued&tenant_id=eq.${encodeURIComponent(TENANT)}&order=created_at.asc&limit=1&select=*`
  );
  if (!rows?.length) return null;
  const job = rows[0];
  const claimed = await rest(
    "PATCH",
    `print_jobs?id=eq.${job.id}&status=eq.queued&tenant_id=eq.${encodeURIComponent(TENANT)}`,
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

let lastHeartbeat = 0;
const HEARTBEAT_MS = 15000;

/**
 * The pulse the app checks before a waiter taps Send. A stale row means
 * "tickets will queue, not print" — said up front, not discovered later.
 */
async function heartbeat() {
  if (Date.now() - lastHeartbeat < HEARTBEAT_MS) return;
  lastHeartbeat = Date.now();
  try {
    await rest("POST", "print_bridge_status?on_conflict=tenant_id", [
      {
        tenant_id: TENANT,
        seen_at: new Date().toISOString(),
        printers: Object.fromEntries(
          Object.entries(printers).map(([k, v]) => [k, v.host])
        ),
      },
    ]);
  } catch (err) {
    console.error(`heartbeat failed: ${err?.message ?? err}`);
  }
}

async function tick() {
  await heartbeat();
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
    // The bar prints kitchen-style tickets; only the receipt printer needs money.
    const render = job.printer === "receipt" ? renderReceipt : renderKitchenTicket;
    const bytes = render(job.payload, {
      width: printer.width ?? 42,
      encoding: printer.encoding,
      codepageByte: printer.codepageByte,
    });
    await printTo(printer.host, bytes, printer.port ?? 9100);
    await finish(job.id, true);
    console.log(`printed ${job.printer} job ${job.id} -> ${printer.host}`);
  } catch (err) {
    await finish(job.id, false, String(err?.message ?? err));
    console.error(`FAILED ${job.printer} job ${job.id}: ${err?.message ?? err}`);
  }
}

console.log(`print bridge up — branch ${TENANT}, watching ${URL_} every ${POLL_MS / 1000}s`);
console.log(`printers: ${Object.entries(printers).map(([k, v]) => `${k}=${v.host}`).join(", ")}`);

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
