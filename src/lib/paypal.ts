// PayPal REST (Orders v2 + Payments v2), sandbox.
// Money flow: buyer approves an AUTHORIZE order per milestone (funds held),
// verified evidence -> capture (full or partial), failed/tampered -> void.

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in .env.local");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cached.token;
}

async function pp<T = Record<string, unknown>>(path: string, method = "POST", body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`PayPal ${method} ${path} failed: ${JSON.stringify(data)}`);
  return data as T;
}

export const usd = (n: number) => ({ currency_code: "USD", value: n.toFixed(2) });

export async function checkCredentials() {
  await token();
  return true;
}

/** One order per milestone. intent AUTHORIZE = money is held, not taken. */
export async function createMilestoneOrder(amountUsd: number, referenceId: string, description: string) {
  const o = await pp<{ id: string }>("/v2/checkout/orders", "POST", {
    intent: "AUTHORIZE",
    purchase_units: [{ reference_id: referenceId, description: description.slice(0, 127), amount: usd(amountUsd) }],
  });
  return o.id;
}

type AuthorizeResp = {
  purchase_units: { payments: { authorizations: { id: string; status: string; expiration_time?: string }[] } }[];
};

/** Called after the buyer approves in the PayPal popup. Returns the authorization. */
export async function authorizeOrder(orderId: string) {
  const o = await pp<AuthorizeResp>(`/v2/checkout/orders/${orderId}/authorize`, "POST", {});
  const a = o.purchase_units[0].payments.authorizations[0];
  return { authorizationId: a.id, status: a.status, expiresAt: a.expiration_time };
}

/** Release money. Pass an amount for a partial release; final_capture voids the remainder. */
export async function captureAuthorization(authorizationId: string, amountUsd?: number) {
  const body = amountUsd === undefined ? {} : { amount: usd(amountUsd), final_capture: true };
  const c = await pp<{ id: string; status: string }>(
    `/v2/payments/authorizations/${authorizationId}/capture`,
    "POST",
    body
  );
  return { captureId: c.id, status: c.status };
}

/** Evidence failed or tampered -> the held money is released back to the buyer. */
export async function voidAuthorization(authorizationId: string) {
  await pp(`/v2/payments/authorizations/${authorizationId}/void`, "POST");
  return { status: "VOIDED" };
}
