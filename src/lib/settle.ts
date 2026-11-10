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
  amountUsd?: number
) {
  const ms = deal.milestones[mid];
  if (!ms.authorizationId) throw new Error("Milestone has no PayPal authorization.");

  if (action === "void") {
    await voidAuthorization(ms.authorizationId);
    ms.status = "voided";
    ms.releasedUsd = 0;
    appendEntry(deal.log, "voided", { milestone: mid, by, reason, refundedToBuyerUsd: ms.amountUsd });
  } else {
    const partial = action === "partial_release" && amountUsd !== undefined && amountUsd < ms.amountUsd;
    const cap = await captureAuthorization(ms.authorizationId, partial ? amountUsd : undefined);
    ms.captureId = cap.captureId;
    ms.releasedUsd = partial ? amountUsd : ms.amountUsd;
    ms.status = partial ? "partially_released" : "released";
    appendEntry(deal.log, partial ? "partially_released" : "released", {
      milestone: mid,
      by,
      reason,
      releasedUsd: ms.releasedUsd,
      paypalCaptureId: cap.captureId,
    });
  }

  const done = Object.values(deal.milestones).every((m) =>
    ["released", "partially_released", "voided"].includes(m.status)
  );
  if (done) {
    deal.status = "completed";
    appendEntry(deal.log, "contract_completed", {
      totalReleasedUsd: Object.values(deal.milestones).reduce((s, m) => s + (m.releasedUsd ?? 0), 0),
    });
  }
}
