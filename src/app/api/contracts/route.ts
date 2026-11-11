import { NextResponse } from "next/server";
import crypto from "crypto";
import { draftContract } from "@/lib/verify";
import { milestoneAmount } from "@/lib/contract";
import { appendEntry, sha256 } from "@/lib/ledger";
import { saveNewDeal, type Deal } from "@/lib/store";


// POST multipart: dealText (string), audio (optional file: voice note in Hindi/English)
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const dealText = String(form.get("dealText") ?? "").trim();
    const category = String(form.get("category") ?? "") || undefined;
    const audioFile = form.get("audio");
    let audio: { mime: string; base64: string } | undefined;
    if (audioFile instanceof File && audioFile.size > 0) {
      audio = { mime: audioFile.type || "audio/webm", base64: Buffer.from(await audioFile.arrayBuffer()).toString("base64") };
    }
    if (!dealText && !audio) return NextResponse.json({ error: "Describe the deal or attach a voice note." }, { status: 400 });

    const contract = await draftContract(dealText, audio, category);
    const deal: Deal = {
      id: crypto.randomBytes(5).toString("hex"),
      createdAt: new Date().toISOString(),
      dealText,
      contract,
      accepted: {},
      status: "draft",
      milestones: Object.fromEntries(
        contract.milestones.map((m) => [m.id, { status: "awaiting_funding", amountInr: milestoneAmount(contract, m), evidence: [] }])
      ),
      log: [],
    };
    appendEntry(deal.log, "contract_drafted", {
      by: "ai",
      inputHash: sha256(dealText + (audio?.base64 ?? "")),
      draftHash: sha256(JSON.stringify(contract)),
      voiceNote: Boolean(audio),
    });
    await saveNewDeal(deal);
    return NextResponse.json({ id: deal.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
