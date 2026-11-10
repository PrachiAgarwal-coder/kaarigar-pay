import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { allEvidenceHashes, getDeal, updateDeal, UPLOAD_DIR } from "@/lib/store";
import { appendEntry, sha256 } from "@/lib/ledger";
import { decide, verifyEvidence } from "@/lib/verify";
import { settle } from "@/lib/settle";


const MAX_BYTES = 8 * 1024 * 1024;

// Seller submits evidence (multipart "file"). Pipeline:
// hash -> duplicate check -> AI inspection -> deterministic decision -> PayPal capture / void / buyer review
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/evidence">) {
  const { id, mid } = await ctx.params;
  try {
    const deal = await getDeal(id);
    if (!deal) throw new Error("Deal not found");
    const ms = deal.milestones[mid];
    const m = deal.contract.milestones.find((x) => x.id === mid);
    if (!ms || !m) throw new Error("Milestone not found");
    if (ms.status !== "funded") throw new Error(`Milestone is "${ms.status}", evidence not accepted now.`);

    const form = await req.formData();
    const file = form.get("file");
    const capturedInApp = form.get("capturedInApp") === "true";
    if (!(file instanceof File)) throw new Error("No file uploaded");
    if (!file.type.startsWith("image/")) throw new Error("Evidence must be an image (documents: photograph them).");
    if (file.size > MAX_BYTES) throw new Error("Image too large (max 8 MB).");

    const buf = Buffer.from(await file.arrayBuffer());
    const fileHash = sha256(buf);
    const isDuplicate = (await allEvidenceHashes()).has(fileHash);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "img";
    const stored = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, `${fileHash}.${ext}`);
    await fs.writeFile(stored, buf);

    const verification = await verifyEvidence(deal.contract, m, { mime: file.type, base64: buf.toString("base64") });
    const decision = decide(verification, m, ms.amountUsd, deal.contract.allowPartialRelease, isDuplicate);

    const result = await updateDeal(id, async (d) => {
      const s = d.milestones[mid];
      s.evidence.push({ fileHash, mime: file.type, file: path.basename(stored), ts: new Date().toISOString() });
      s.verification = verification;
      s.decision = decision;
      appendEntry(d.log, "evidence_submitted", { milestone: mid, fileHash, capturedInApp, duplicate: isDuplicate });
      appendEntry(d.log, "ai_verdict", {
        milestone: mid,
        decision: decision.action,
        reason: decision.reason,
        overallConfidence: verification.overallConfidence,
        reportHash: sha256(JSON.stringify(verification)),
      });

      if (decision.action === "release") await settle(d, mid, "release", "auto-rule", decision.reason);
      else if (decision.action === "partial_release")
        await settle(d, mid, "partial_release", "auto-rule", decision.reason, decision.amountUsd);
      else if (decision.action === "block") await settle(d, mid, "void", "auto-rule", decision.reason);
      else s.status = "in_review";
      return { status: s.status, decision, verification };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
