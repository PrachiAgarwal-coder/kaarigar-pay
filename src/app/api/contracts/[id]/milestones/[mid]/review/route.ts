import { NextResponse } from "next/server";
import { updateDeal } from "@/lib/store";
import { settle } from "@/lib/settle";


// Buyer resolves a milestone the AI was not confident about.
// POST { action: "approve" | "reject", note?: string }
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/review">) {
  const { id, mid } = await ctx.params;
  try {
    const { action, note } = await req.json();
    const status = await updateDeal(id, async (d) => {
      const s = d.milestones[mid];
      if (s.status !== "in_review") throw new Error("Milestone is not awaiting review.");
      if (action === "approve") await settle(d, mid, "release", "buyer", note || "Buyer approved after review");
      else if (action === "reject") await settle(d, mid, "void", "buyer", note || "Buyer rejected evidence");
      else throw new Error("action must be approve or reject");
      return s.status;
    });
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
