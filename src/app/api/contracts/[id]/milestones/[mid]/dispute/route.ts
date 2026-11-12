import { NextResponse } from "next/server";
import { updateDeal } from "@/lib/store";
import { settle } from "@/lib/settle";
import { appendEntry } from "@/lib/ledger";
import { requireParty } from "@/lib/auth";

// Seller responds to a buyer rejection.
// POST { action: "accept_refund" | "escalate", note?: string }
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/dispute">) {
  const { id, mid } = await ctx.params;
  try {
    const { action, note } = await req.json();
    const status = await updateDeal(id, async (d) => {
      requireParty(d, req, "seller");
      const s = d.milestones[mid];
      if (s.status !== "disputed") throw new Error("Milestone is not in dispute.");
      if (action === "accept_refund") await settle(d, mid, "void", "seller", note || "Seller accepted the refund");
      else if (action === "escalate") {
        s.status = "arbitration";
        appendEntry(d.log, "escalated_to_arbitration", {
          milestone: mid,
          note: note || "Seller disputes the rejection",
          clause: d.contract.disputeResolution,
          fundsStill: "held",
          evidenceHashes: s.evidence.map((e) => e.fileHash),
        });
      } else throw new Error("action must be accept_refund or escalate");
      return s.status;
    });
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
