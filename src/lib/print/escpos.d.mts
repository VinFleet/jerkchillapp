/**
 * Types for the shared ESC/POS renderer (escpos.mjs — plain ESM so the
 * dependency-free bridge can import it too). Only what the app calls.
 */

export type RenderOpts = {
  width?: number;
  encoding?: "ascii" | "cp1258";
  codepageByte?: number;
};

export function renderKitchenTicket(job: unknown, widthOrOpts?: number | RenderOpts): Uint8Array;
export function renderReceipt(job: unknown, widthOrOpts?: number | RenderOpts): Uint8Array;
export function toAscii(text: string): string;
export function encodeCp1258(text: string): Uint8Array;
