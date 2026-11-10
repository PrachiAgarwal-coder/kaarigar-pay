import crypto from "crypto";

export const sha256 = (d: string | Buffer) => crypto.createHash("sha256").update(d).digest("hex");

export type LedgerEntry = {
  seq: number;
  ts: string;
  event: string; // "contract_drafted", "accepted", "funded", "evidence", "released", ...
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

export const GENESIS = "0".repeat(64);

/** Append-only, hash-chained log. Editing any past entry breaks every hash after it. */
export function appendEntry(log: LedgerEntry[], event: string, data: Record<string, unknown>): LedgerEntry {
  const prev = log[log.length - 1];
  const body = {
    seq: log.length,
    ts: new Date().toISOString(),
    event,
    data,
    prevHash: prev ? prev.hash : GENESIS,
  };
  const entry = { ...body, hash: sha256(JSON.stringify(body)) };
  log.push(entry);
  return entry;
}

/** Re-computes every hash. Returns index of first broken entry, or -1 if intact. */
export function verifyChain(log: LedgerEntry[]): number {
  for (let i = 0; i < log.length; i++) {
    const { hash, ...body } = log[i];
    const expectedPrev = i === 0 ? GENESIS : log[i - 1].hash;
    if (body.prevHash !== expectedPrev || sha256(JSON.stringify(body)) !== hash) return i;
  }
  return -1;
}
