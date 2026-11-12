import { NextResponse } from "next/server";
import { getDeal, updateDeal } from "@/lib/store";
import { verifyChain, appendEntry, sha256 } from "@/lib/ledger";
import { ContractSchema, normalizeContract, milestoneAmount } from "@/lib/contract";
import { publicDeal, roleFor } from "@/lib/auth";


export async function GET(req: Request, ctx: RouteContext<"/api/contracts/[id]">) {
  const { id } = await ctx.params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const key = req.headers.get("x-kp-key") ?? new URL(req.url).searchParams.get("k");
  return NextResponse.json({
    ...publicDeal(deal),
    chainBrokenAt: verifyChain(deal.log),
    viewerRole: roleFor(deal, key),
    privateLinks: Boolean(deal.buyerToken),
  });
}

// PUT { contract } — either party edits the draft before signing. Edits reset acceptances.
export async function PUT(req: Request, ctx: RouteContext<"/api/contracts/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = ContractSchema.safeParse(body.contract);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    const contract = normalizeContract(parsed.data);
    await updateDeal(id, (d) => {
      if (d.buyerToken && !roleFor(d, req.headers.get("x-kp-key"))) throw new Error("Only the buyer or seller can edit.");
      if (d.status !== "draft") throw new Error("Contract is already signed and locked.");
      d.contract = contract;
      d.accepted = {};
      d.milestones = Object.fromEntries(
        contract.milestones.map((m) => [m.id, { status: "awaiting_funding" as const, amountInr: milestoneAmount(contract, m), evidence: [] }])
      );
      appendEntry(d.log, "contract_edited", { by: body.party ?? "unknown", draftHash: sha256(JSON.stringify(contract)) });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
