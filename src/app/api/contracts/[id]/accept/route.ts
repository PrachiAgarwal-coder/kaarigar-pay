import { NextResponse } from "next/server";
import { updateDeal } from "@/lib/store";
import { appendEntry, sha256 } from "@/lib/ledger";


// POST { party: "buyer" | "seller", name: string }
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/accept">) {
  const { id } = await ctx.params;
  try {
    const { party, name } = await req.json();
    if (party !== "buyer" && party !== "seller") throw new Error("party must be buyer or seller");
    const deal = await updateDeal(id, (d) => {
      if (d.status !== "draft") throw new Error("Already signed.");
      const termsHash = sha256(JSON.stringify(d.contract));
      d.accepted[party as "buyer" | "seller"] = new Date().toISOString();
      appendEntry(d.log, "accepted", { party, name: name || party, termsHash });
      if (d.accepted.buyer && d.accepted.seller) {
        d.termsHash = termsHash;
        d.status = "active";
        appendEntry(d.log, "contract_locked", { termsHash });
      }
      return d;
    });
    return NextResponse.json({ status: deal.status, termsHash: deal.termsHash });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
