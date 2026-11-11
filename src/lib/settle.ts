import { captureAuthorization, voidAuthorization } from "./paypal";
import { appendEntry } from "./ledger";
import type { Deal } from "./store";

/** Executes money movement for a milestone and records it in the hash chain. */
export async function settle(
  deal: Deal,
  mid: string,
  action: "release" | "partial_release" | "void",
  by: string,
  reason: string,
  amountInr?: number
) {
  const ms = deal.milestones[mid];
  if (!ms.authorizationId) throw new Error("Milestone has no PayPal authorization.");

  if (action === "void") {
    await voidAuthorization(ms.authorizationId);
    ms.status = "voided";
    ms.releasedInr = 0;
    appendEntry(deal.log, "voided", { milestone: mid, by, reason, refundedToBuyerInr: ms.amountInr });
  } else {
    const partial = action === "partial_release" && amountInr !== undefined && amountInr < ms.amountInr;
    // convert the rupee release into the same share of the USD authorization
    const partialUsd =
      partial && ms.chargedUsd ? Math.floor(((ms.chargedUsd * amountInr!) / ms.amountInr) * 100) / 100 : undefined;
    const cap = await captureAuthorization(ms.authorizationId, partialUsd);
    ms.captureId = cap.captureId;
    ms.releasedInr = partial ? amountInr : ms.amountInr;
    ms.status = partial ? "partially_released" : "released";
    appendEntry(deal.log, partial ? "partially_released" : "released", {
      milestone: mid,
      by,
      reason,
      releasedInr: ms.releasedInr,
      capturedUsd: partialUsd ?? ms.chargedUsd,
      paypalCaptureId: cap.captureId,
    });
  }

  const done = Object.values(deal.milestones).every((m) =>
    ["released", "partially_released", "voided"].includes(m.status)
  );
  if (done) {
    deal.status = "completed";
    appendEntry(deal.log, "contract_completed", {
      totalReleasedInr: Object.values(deal.milestones).reduce((s, m) => s + (m.releasedInr ?? 0), 0),
    });
  }
}
