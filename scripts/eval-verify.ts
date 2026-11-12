/**
 * Evaluation harness for evidence verification.
 *
 *   GEMINI_API_KEY=... npx tsx scripts/eval-verify.ts
 *
 * Reads evals/cases.json, runs every case through the real pipeline
 * (Gemini inspection → deterministic decide()), and prints accuracy metrics.
 * Put your test photos in evals/images/.
 */
import fs from "fs";
import path from "path";
import { decide, verifyEvidence } from "../src/lib/verify";
import { normalizeContract, type Contract } from "../src/lib/contract";

type Expected = "release" | "partial_release" | "review" | "block";
type Case = { id: string; images: string[]; checks: string[]; expected: Expected; note?: string };

const root = path.join(process.cwd(), "evals");
const cases: Case[] = JSON.parse(fs.readFileSync(path.join(root, "cases.json"), "utf8"));

const contractFor = (checks: string[]): Contract =>
  normalizeContract({
    title: "Evaluation contract",
    category: "handicrafts",
    terms: {
      paymentStructure: "", incoterm: "", deliveryTimeline: "", inspection: "",
      qualityStandards: [], returnsAndDefects: "", latePenalty: "", standardPracticeNote: "",
    },
    buyer: { name: "Buyer", country: "USA" },
    seller: { name: "Seller", country: "India" },
    totalAmountInr: 76000,
    items: [{ name: "Kundan jhumka earrings (pair)", quantity: 20, specs: [] }],
    milestones: [
      { id: "m1", name: "Milestone under test", percent: 100, autoReleaseMinConfidence: 0.9,
        evidenceRequired: [{ type: "photo", description: "Evidence under test", checks }] },
    ],
    buyerReviewHours: 48,
    allowPartialRelease: true,
    governingLaw: "", disputeResolution: "",
  });

const mime = (f: string) => (f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg");

async function main() {
  const rows: { id: string; expected: Expected; got: Expected; ms: number }[] = [];
  for (const c of cases) {
    const contract = contractFor(c.checks);
    const m = contract.milestones[0];
    const images = c.images.map((f) => ({ mime: mime(f), base64: fs.readFileSync(path.join(root, "images", f)).toString("base64") }));
    const t0 = Date.now();
    const v = await verifyEvidence(contract, m, images);
    const d = decide(v, m, 76000, true, false);
    rows.push({ id: c.id, expected: c.expected, got: d.action, ms: Date.now() - t0 });
    console.log(`${d.action === c.expected ? "✓" : "✗"} ${c.id.padEnd(28)} expected ${c.expected.padEnd(15)} got ${d.action.padEnd(15)} ${Date.now() - t0}ms`);
  }
  const n = rows.length;
  const correct = rows.filter((r) => r.expected === r.got).length;
  const shouldNotPay = rows.filter((r) => r.expected === "block" || r.expected === "review");
  const falseRelease = shouldNotPay.filter((r) => r.got === "release" || r.got === "partial_release").length;
  const attacks = rows.filter((r) => r.expected === "block");
  const blocked = attacks.filter((r) => r.got === "block").length;
  const genuine = rows.filter((r) => r.expected === "release");
  const autoReleased = genuine.filter((r) => r.got === "release").length;
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log("\n--- metrics ---");
  console.log(`decision accuracy        ${correct}/${n}`);
  console.log(`false release rate       ${falseRelease}/${shouldNotPay.length}  (paid when it should not have; target 0)`);
  console.log(`attack block rate        ${blocked}/${attacks.length}`);
  console.log(`genuine auto-release     ${autoReleased}/${genuine.length}`);
  console.log(`median latency           ${ms[Math.floor(ms.length / 2)] ?? 0} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
