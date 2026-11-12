import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { allEvidenceHashes, getDeal, updateDeal, UPLOAD_DIR } from "@/lib/store";
import { appendEntry, sha256 } from "@/lib/ledger";
import { decide, verifyEvidence } from "@/lib/verify";
import { settle } from "@/lib/settle";
import { requireParty } from "@/lib/auth";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 4;

// Seller submits evidence (multipart, one or more "file" fields: e.g. goods photo + invoice photo).
// Pipeline: hash -> duplicate check -> AI inspection of all images together -> deterministic decision
//           -> PayPal capture / void / buyer review
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/evidence">) {
  const { id, mid } = await ctx.params;
  try {
    const deal = await getDeal(id);
    if (!deal) throw new Error("Deal not found");
    const ms = deal.milestones[mid];
    const m = deal.contract.milestones.find((x) => x.id === mid);
    if (!ms || !m) throw new Error("Milestone not found");
    requireParty(deal, req, "seller");
    if (ms.status !== "funded" && ms.status !== "disputed")
      throw new Error(`Milestone is "${ms.status}", evidence not accepted now.`);

    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    const capturedInApp = form.get("capturedInApp") === "true";
    if (!files.length) throw new Error("No file uploaded");
    if (files.length > MAX_FILES) throw new Error(`Up to ${MAX_FILES} images per submission.`);

    const known = await allEvidenceHashes();
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const stored: { fileHash: string; mime: string; file: string; base64: string }[] = [];
    let isDuplicate = false;
    for (const file of files) {
      if (!file.type.startsWith("image/")) throw new Error("Evidence must be images (photograph documents).");
      if (file.size > MAX_BYTES) throw new Error("Image too large (max 8 MB each).");
      const buf = Buffer.from(await file.arrayBuffer());
      const fileHash = sha256(buf);
      if (known.has(fileHash)) isDuplicate = true;
      const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "img";
      const name = `${fileHash}.${ext}`;
      await fs.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), buf);
      stored.push({ fileHash, mime: file.type, file: name, base64: buf.toString("base64") });
    }

    const verification = await verifyEvidence(
      deal.contract,
      m,
      stored.map((s) => ({ mime: s.mime, base64: s.base64 }))
    );
    const decision = decide(verification, m, ms.amountInr, deal.contract.allowPartialRelease, isDuplicate);

    const result = await updateDeal(id, async (d) => {
      const s = d.milestones[mid];
      const batch = Math.max(0, ...s.evidence.map((e) => e.batch ?? 0)) + 1;
      const ts = new Date().toISOString();
      for (const f of stored) s.evidence.push({ fileHash: f.fileHash, mime: f.mime, file: f.file, ts, batch });
      s.verification = verification;
      s.decision = decision;
      appendEntry(d.log, "evidence_submitted", {
        milestone: mid,
        fileHashes: stored.map((f) => f.fileHash),
        capturedInApp,
        duplicate: isDuplicate,
      });
      appendEntry(d.log, "ai_verdict", {
        milestone: mid,
        decision: decision.action,
        reason: decision.reason,
        checksPassed: `${verification.checks.filter((c) => c.result === "pass").length}/${verification.checks.length}`,
        reportHash: sha256(JSON.stringify(verification)),
      });

      if (decision.action === "release") await settle(d, mid, "release", "auto-rule", decision.reason);
      else if (decision.action === "partial_release")
        await settle(d, mid, "partial_release", "auto-rule", decision.reason, decision.amountInr);
      else if (decision.action === "block") await settle(d, mid, "void", "auto-rule", decision.reason);
      else s.status = "in_review";
      return { status: s.status, decision, verification };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Serve an evidence image: ?h=<fileHash prefix> (defaults to the latest file).
export async function GET(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/evidence">) {
  const { id, mid } = await ctx.params;
  const h = new URL(req.url).searchParams.get("h");
  const deal = await getDeal(id);
  const list = deal?.milestones[mid]?.evidence ?? [];
  const ev = h ? list.find((e) => e.fileHash.startsWith(h)) : list.at(-1);
  if (!ev) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(ev.file)));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": ev.mime, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
