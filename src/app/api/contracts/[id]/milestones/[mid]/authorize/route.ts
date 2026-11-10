import { NextResponse } from "next/server";
import { updateDeal } from "@/lib/store";
import { authorizeOrder } from "@/lib/paypal";
import { appendEntry } from "@/lib/ledger";


// Buyer approved in the PayPal popup -> authorize = funds held, not taken.
export async function POST(req: Request, ctx: RouteContext<"/api/contracts/[id]/milestones/[mid]/authorize">) {
  const { id, mid } = await ctx.params;
  try {
    const { orderId } = await req.json();
    const auth = await authorizeOrder(orderId);
    await updateDeal(id, (d) => {
      const ms = d.milestones[mid];
      if (ms.orderId !== orderId) throw new Error("Order does not match milestone");
      ms.authorizationId = auth.authorizationId;
      ms.authorizationExpiresAt = auth.expiresAt;
      ms.status = "funded";
      appendEntry(d.log, "funded", {
        milestone: mid,
        amountUsd: ms.amountUsd,
        paypalOrderId: orderId,
        paypalAuthorizationId: auth.authorizationId,
      });
    });
    return NextResponse.json(auth);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
