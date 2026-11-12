import { NextResponse } from "next/server";
import { getDeal, updateDeal } from "@/lib/store";
import { createMilestoneOrder } from "@/lib/paypal";
import { requireParty } from "@/lib/auth";
import { DEFAULT_FX_INR_PER_USD, formatInr, inrToUsd } from "@/lib/contract";


// Buyer clicks the PayPal button -> we create an AUTHORIZE order for this milestone's amount.
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/order">) {
  const { id, mid } = await ctx.params;
  try {
    const deal = await getDeal(id);
    if (!deal) throw new Error("Deal not found");
    requireParty(deal, req, "buyer");
    if (deal.status !== "active") throw new Error("Both parties must sign before funding.");
    const ms = deal.milestones[mid];
    const m = deal.contract.milestones.find((x) => x.id === mid);
    if (!ms || !m) throw new Error("Milestone not found");
    if (ms.status !== "awaiting_funding") throw new Error("Milestone already funded.");
    const chargedUsd = inrToUsd(ms.amountInr, deal.fxInrPerUsd ?? DEFAULT_FX_INR_PER_USD);
    const orderId = await createMilestoneOrder(chargedUsd, `${id}-${mid}`, `${deal.contract.title}: ${m.name} (${formatInr(ms.amountInr)})`);
    await updateDeal(id, (d) => {
      d.milestones[mid].orderId = orderId;
      d.milestones[mid].chargedUsd = chargedUsd;
    });
    return NextResponse.json({ orderId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
