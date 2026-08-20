/**
 * Generates src/lib/zalo/errorTable.ts from zalo-errors.json.
 *
 * The rule in CLAUDE.md is explicit: generate error handling from the JSON,
 * never transcribe codes by hand. Hand-transcription is how -211 and -1441 got
 * filed as "transient" here when they are quota conditions that will not clear
 * by retrying today.
 *
 * Run: npm run gen:zalo-errors
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync(new URL("../src/lib/zalo/zalo-errors.json", import.meta.url)));

// Same code can appear on more than one surface (-100 is transient on ZBS,
// asset-expiry on OA). Keep the most cautious class, and record overloading so
// callers know to read the message string.
const byCode = new Map();
const RANK = { success: 0, permanent: 1, quota: 2, night_ban: 3, transient: 4, auth_refresh: 5, needs_human: 6 };

for (const e of src.errors) {
  const existing = byCode.get(e.code);
  if (!existing) {
    byCode.set(e.code, { code: e.code, cls: e.retry_class, overloaded: e.overloaded, messages: [e.message] });
    continue;
  }
  existing.messages.push(e.message);
  existing.overloaded = existing.overloaded || e.overloaded || existing.cls !== e.retry_class;
  if (RANK[e.retry_class] > RANK[existing.cls]) existing.cls = e.retry_class;
}

const rows = [...byCode.values()].sort((a, b) => a.code - b.code);

const out = `// GENERATED FILE — do not edit by hand.
// Source: zalo-errors.json (compiled ${src.compiled})
// Regenerate: npm run gen:zalo-errors
//
// ${src.notes.join("\n// ")}

export type ZaloRetryClass =
${Object.keys(RANK).map((k) => `  | ${JSON.stringify(k)}`).join("\n")};

// A Map rather than an object: almost every Zalo code is negative, and
// negative numeric keys are not valid object-literal syntax.
export const ZALO_ERROR_CLASS: ReadonlyMap<number, ZaloRetryClass> = new Map([
${rows.map((r) => `  [${r.code}, ${JSON.stringify(r.cls)}],`).join("\n")}
]);

/** Codes carrying more than one meaning — branch on the message, not the code. */
export const ZALO_OVERLOADED_CODES: ReadonlySet<number> = new Set([
${rows.filter((r) => r.overloaded).map((r) => `  ${r.code},`).join("\n")}
]);

export const ZALO_ERROR_COUNT = ${rows.length};
`;

writeFileSync(new URL("../src/lib/zalo/errorTable.ts", import.meta.url), out);
console.log(`generated ${rows.length} codes, ${rows.filter((r) => r.overloaded).length} overloaded`);
