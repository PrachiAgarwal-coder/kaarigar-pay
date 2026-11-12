import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeContract, milestoneAmount, inrToUsd, type Contract } from "../src/lib/contract";
import { roleFor, requireParty, publicDeal } from "../src/lib/auth";
import type { Deal } from "../src/lib/store";

const contract = {
  title: "t",
  category: "handicrafts",
  terms: { paymentStructure: "", incoterm: "", deliveryTimeline: "", inspection: "", qualityStandards: [], returnsAndDefects: "", latePenalty: "", standardPracticeNote: "" },
  buyer: { name: "B", country: "USA" },
  seller: { name: "S", country: "India" },
  totalAmountInr: 76000,
  items: [{ name: "x", quantity: 1, specs: [] }],
  milestones: [
    { id: "a", name: "1", percent: 33, evidenceRequired: [{ type: "photo", description: "d", checks: ["c"] }], autoReleaseMinConfidence: 0.9 },
    { id: "a", name: "2", percent: 33, evidenceRequired: [{ type: "photo", description: "d", checks: ["c"] }], autoReleaseMinConfidence: 0.9 },
    { id: "a", name: "3", percent: 33, evidenceRequired: [{ type: "photo", description: "d", checks: ["c"] }], autoReleaseMinConfidence: 0.9 },
  ],
  buyerReviewHours: 48,
  allowPartialRelease: true,
  governingLaw: "g",
  disputeResolution: "d",
} as Contract;

test("milestone percentages are normalised to exactly 100 with unique ids", () => {
  const c = normalizeContract(contract);
  assert.equal(c.milestones.reduce((s, m) => s + m.percent, 0), 100);
  assert.deepEqual(c.milestones.map((m) => m.id), ["m1", "m2", "m3"]);
});

test("milestone amounts are whole rupees", () => {
  const c = normalizeContract(contract);
  for (const m of c.milestones) assert.equal(Number.isInteger(milestoneAmount(c, m)), true);
});

test("INR to USD conversion at the locked rate", () => {
  assert.equal(inrToUsd(22800, 88), 259.09);
});

test("private-link tokens map to the right party and gate actions", () => {
  const deal = { buyerToken: "b".repeat(32), sellerToken: "s".repeat(32) } as Deal;
  assert.equal(roleFor(deal, "b".repeat(32)), "buyer");
  assert.equal(roleFor(deal, "s".repeat(32)), "seller");
  assert.equal(roleFor(deal, "x".repeat(32)), null);
  const asSeller = new Request("http://x", { headers: { "x-kp-key": "s".repeat(32) } });
  assert.throws(() => requireParty(deal, asSeller, "buyer"));
  assert.doesNotThrow(() => requireParty(deal, asSeller, "seller"));
});

test("secrets are stripped before a deal reaches the browser", () => {
  const out = publicDeal({ id: "1", buyerToken: "b", sellerToken: "s" } as unknown as Deal) as Record<string, unknown>;
  assert.equal("buyerToken" in out, false);
  assert.equal("sellerToken" in out, false);
});
