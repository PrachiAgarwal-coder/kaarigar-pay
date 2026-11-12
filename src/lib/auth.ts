// Private-link access: each party gets a secret token in their link (?k=...).
// Actions check the token, so the seller can't approve their own payment and vice versa.
import crypto from "crypto";
import type { Deal } from "./store";

export type Party = "buyer" | "seller";

export const newToken = () => crypto.randomBytes(16).toString("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function roleFor(deal: Deal, key: string | null | undefined): Party | null {
  if (!key) return null;
  if (deal.buyerToken && same(key, deal.buyerToken)) return "buyer";
  if (deal.sellerToken && same(key, deal.sellerToken)) return "seller";
  return null;
}

/** Throws unless the request carries the given party's key. Deals created before tokens existed are open. */
export function requireParty(deal: Deal, req: Request, party: Party) {
  if (!deal.buyerToken && !deal.sellerToken) return;
  const key = req.headers.get("x-kp-key") ?? new URL(req.url).searchParams.get("k");
  if (roleFor(deal, key) !== party) throw new Error(`Only the ${party} can do this (use the ${party}'s private link).`);
}

/** Strip secrets before sending a deal to the browser. */
export function publicDeal(deal: Deal) {
  const { buyerToken, sellerToken, ...rest } = deal;
  void buyerToken;
  void sellerToken;
  return rest;
}
