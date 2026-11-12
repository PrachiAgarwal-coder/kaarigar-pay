import { test } from "node:test";
import assert from "node:assert/strict";
import { appendEntry, verifyChain, type LedgerEntry } from "../src/lib/ledger";

function sample(): LedgerEntry[] {
  const log: LedgerEntry[] = [];
  appendEntry(log, "contract_drafted", { by: "ai" });
  appendEntry(log, "accepted", { party: "seller" });
  appendEntry(log, "accepted", { party: "buyer" });
  appendEntry(log, "funded", { milestone: "m1", amountInr: 22800 });
  appendEntry(log, "released", { milestone: "m1", releasedInr: 22800 });
  return log;
}

test("an untouched chain verifies", () => {
  assert.equal(verifyChain(sample()), -1);
});

test("editing a past entry's data breaks the chain at that entry", () => {
  const log = sample();
  (log[3].data as { amountInr: number }).amountInr = 1;
  assert.equal(verifyChain(log), 3);
});

test("deleting an entry breaks the chain", () => {
  const log = sample();
  log.splice(2, 1); // delete the buyer's acceptance
  assert.equal(verifyChain(log), 2);
});

test("each entry links to the previous hash", () => {
  const log = sample();
  for (let i = 1; i < log.length; i++) assert.equal(log[i].prevHash, log[i - 1].hash);
});
