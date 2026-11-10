import { NextResponse } from "next/server";
import { getDeal, updateDeal } from "@/lib/store";
import { createMilestoneOrder } from "@/lib/paypal";


// Buyer clicks the PayPal button -> we create an AUTHORIZE order for this milestone's amount.
export async function POST(_: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/order">) {
  const { id, mid } = await ctx.params;
  try {
    const deal = await getDeal(id);
    if (!deal) throw new Error("Deal not found");
    if (deal.status !== "active") throw new Error("Both parties must sign before funding.");
    const ms = deal.milestones[mid];
    const m = deal.contract.milestones.find((x) => x.id === mid);
    if (!ms || !m) throw new Error("Milestone not found");
    if (ms.status !== "awaiting_funding") throw new Error("Milestone already funded.");
    const orderId = await createMilestoneOrder(ms.amountUsd, `${id}-${mid}`, `${deal.contract.title} — ${m.name}`);
    await updateDeal(id, (d) => {
      d.milestones[mid].orderId = orderId;
    });
    return NextResponse.json({ orderId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
