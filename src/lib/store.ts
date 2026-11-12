// Tiny JSON-file store. Good enough for the hackathon demo.
// NOTE: on Render's free tier the disk resets on redeploy/spin-down; swap for Postgres if time allows.
import fs from "fs/promises";
import path from "path";
import type { Contract } from "./contract";
import type { LedgerEntry } from "./ledger";
import type { Verification, Decision } from "./verify";

export type MilestoneStatus =
  | "awaiting_funding"
  | "funded" // authorization held
  | "in_review" // AI not confident -> buyer decides
  | "released" // captured (full)
  | "partially_released"
  | "voided" // blocked / refunded -> money back to buyer
  | "disputed" // buyer rejected evidence; money still held; seller may resubmit, accept refund, or escalate
  | "arbitration"; // escalated per the contract's dispute clause; money stays held

export type MilestoneState = {
  status: MilestoneStatus;
  amountInr: number;
  chargedUsd?: number; // what the buyer's PayPal order is for, at the locked rate
  orderId?: string;
  authorizationId?: string;
  authorizationExpiresAt?: string;
  captureId?: string;
  releasedInr?: number;
  evidence: { fileHash: string; mime: string; file: string; ts: string; batch?: number }[];
  verification?: Verification;
  decision?: Decision;
};

export type Deal = {
  id: string;
  createdAt: string;
  dealText: string;
  contract: Contract;
  accepted: { buyer?: string; seller?: string };
  termsHash?: string;
  buyerToken?: string; // private link secret for the buyer
  sellerToken?: string; // private link secret for the seller
  fxInrPerUsd?: number; // locked at signing
  status: "draft" | "active" | "completed";
  milestones: Record<string, MilestoneState>;
  log: LedgerEntry[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type DBShape = { deals: Record<string, Deal> };

let queue: Promise<unknown> = Promise.resolve();

async function readDB(): Promise<DBShape> {
  try {
    return JSON.parse(await fs.readFile(DB, "utf8"));
  } catch {
    return { deals: {} };
  }
}

async function writeDB(db: DBShape) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB, JSON.stringify(db, null, 2));
}

export async function getDeal(id: string): Promise<Deal | null> {
  const db = await readDB();
  return db.deals[id] ?? null;
}

export async function allEvidenceHashes(): Promise<Set<string>> {
  const db = await readDB();
  const s = new Set<string>();
  for (const d of Object.values(db.deals))
    for (const m of Object.values(d.milestones)) for (const e of m.evidence) s.add(e.fileHash);
  return s;
}

/** Serialized read-modify-write so concurrent requests don't clobber each other. */
export function updateDeal<T>(id: string, fn: (d: Deal) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDB();
    const deal = db.deals[id];
    if (!deal) throw new Error("Deal not found");
    const out = await fn(deal);
    await writeDB(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function saveNewDeal(deal: Deal): Promise<void> {
  const run = queue.then(async () => {
    const db = await readDB();
    db.deals[deal.id] = deal;
    await writeDB(db);
  });
  queue = run.catch(() => undefined);
  return run;
}
