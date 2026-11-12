import { NextResponse } from "next/server";
import { updateDeal } from "@/lib/store";
import { settle } from "@/lib/settle";
import { appendEntry } from "@/lib/ledger";
import { requireParty } from "@/lib/auth";

// Buyer resolves a milestone the AI was not confident about.
// approve -> PayPal capture. reject -> DISPUTED: money stays held, seller can resubmit, accept refund, or escalate.
// POST { action: "approve" | "reject", note?: string }
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/review">) {
  const { id, mid } = await ctx.params;
  try {
    const { action, note } = await req.json();
    const status = await updateDeal(id, async (d) => {
      requireParty(d, req, "buyer");
      const s = d.milestones[mid];
      if (s.status !== "in_review") throw new Error("Milestone is not awaiting review.");
      if (action === "approve") await settle(d, mid, "release", "buyer", note || "Buyer approved after review");
      else if (action === "reject") {
        s.status = "disputed";
        appendEntry(d.log, "buyer_rejected", {
          milestone: mid,
          note: note || "Buyer rejected the evidence",
          fundsStill: "held",
          sellerOptions: ["resubmit evidence", "accept refund", "escalate to arbitration"],
        });
      } else throw new Error("action must be approve or reject");
      return s.status;
    });
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
