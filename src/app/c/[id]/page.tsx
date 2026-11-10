"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { Deal, MilestoneState } from "@/lib/store";
import type { Milestone } from "@/lib/contract";

type DealView = Deal & { chainBrokenAt: number };
type Role = "buyer" | "seller";

const STATUS_STYLE: Record<string, string> = {
  awaiting_funding: "bg-neutral-100 text-neutral-700",
  funded: "bg-blue-100 text-blue-800",
  in_review: "bg-amber-100 text-amber-800",
  released: "bg-green-100 text-green-800",
  partially_released: "bg-lime-100 text-lime-800",
  voided: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  awaiting_funding: "Awaiting funding",
  funded: "Funds held by PayPal",
  in_review: "Buyer review",
  released: "Released",
  partially_released: "Partially released",
  voided: "Voided: refunded to buyer",
};

const short = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "");

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealView | null>(null);
  const [role, setRole] = useState<Role>("buyer");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/contracts/${id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) setError(d.error);
    else setDeal(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <main className="p-10 text-red-600">{error}</main>;
  if (!deal) return <main className="p-10 text-neutral-500">Loading contract…</main>;
  const c = deal.contract;
  const released = Object.values(deal.milestones).reduce((s, m) => s + (m.releasedUsd ?? 0), 0);

  return (
    <PayPalScriptProvider
      options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "test", intent: "authorize", currency: "USD" }}
    >
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a href="/" className="text-sm font-semibold uppercase tracking-widest text-amber-600">
              Kaarigar Pay
            </a>
            <h1 className="mt-1 text-3xl font-bold">{c.title}</h1>
            <p className="mt-1 text-neutral-600">
              {c.seller.name} ({c.seller.country}) → {c.buyer.name} ({c.buyer.country}) ·{" "}
              <b>${c.totalAmountUsd.toLocaleString()}</b> · released so far <b>${released.toFixed(2)}</b>
            </p>
          </div>
          <div className="flex rounded-full bg-neutral-100 p-1 text-sm">
            {(["buyer", "seller"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full px-4 py-1.5 capitalize ${role === r ? "bg-white font-semibold shadow" : ""}`}
              >
                View as {r}
              </button>
            ))}
          </div>
        </div>

        {/* Specs */}
        <section className="mt-8 rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold">Specification &amp; tolerances</h2>
          {c.items.map((it) => (
            <div key={it.name} className="mt-4">
              <p className="font-medium">
                {it.quantity} × {it.name}
              </p>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1">Attribute</th>
                    <th>Target</th>
                    <th>Tolerance</th>
                    <th>Photo-verifiable</th>
                  </tr>
                </thead>
                <tbody>
                  {it.specs.map((s) => (
                    <tr key={s.attribute} className="border-t border-neutral-100">
                      <td className="py-1.5">{s.attribute}</td>
                      <td>{s.target}</td>
                      <td>{s.tolerance}</td>
                      <td>{s.verifiableFromPhoto ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="mt-4 text-xs text-neutral-500">
            Governing law: {c.governingLaw} · Disputes: {c.disputeResolution} · Buyer veto window:{" "}
            {c.buyerReviewHours}h · Partial release: {c.allowPartialRelease ? "allowed" : "no"}
          </p>
        </section>

        {/* Signing */}
        {deal.status === "draft" ? (
          <SignPanel deal={deal} onDone={load} />
        ) : (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            🔒 Signed by both parties. Terms locked, hash <code>{short(deal.termsHash)}</code>
          </p>
        )}

        {/* Milestones */}
        <section className="mt-8 space-y-5">
          <h2 className="text-lg font-semibold">Milestones</h2>
          {c.milestones.map((m, i) => (
            <MilestoneCard
              key={m.id}
              index={i}
              m={m}
              ms={deal.milestones[m.id]}
              deal={deal}
              role={role}
              onChange={load}
            />
          ))}
        </section>

        {/* Ledger */}
        <Ledger deal={deal} />
      </main>
    </PayPalScriptProvider>
  );
}

function SignPanel({ deal, onDone }: { deal: DealView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function sign(party: Role) {
    setBusy(true);
    const name = party === "buyer" ? deal.contract.buyer.name : deal.contract.seller.name;
    await fetch(`/api/contracts/${deal.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party, name }),
    });
    setBusy(false);
    onDone();
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <span className="font-medium">Draft. Both parties must sign before funding.</span>
      {(["seller", "buyer"] as Role[]).map((p) =>
        deal.accepted[p] ? (
          <span key={p} className="text-green-700">
            ✓ {p} signed
          </span>
        ) : (
          <button
            key={p}
            disabled={busy}
            onClick={() => sign(p)}
            className="rounded-full bg-neutral-900 px-4 py-1.5 capitalize text-white disabled:opacity-40"
          >
            Sign as {p}
          </button>
        )
      )}
    </div>
  );
}

function MilestoneCard({
  index,
  m,
  ms,
  deal,
  role,
  onChange,
}: {
  index: number;
  m: Milestone;
  ms: MilestoneState;
  deal: DealView;
  role: Role;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const base = `/api/contracts/${deal.id}/milestones/${m.id}`;

  async function submitEvidence(file: File, capturedInApp: boolean) {
    setBusy(true);
    setErr("");
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("capturedInApp", String(capturedInApp));
    const r = await fetch(`${base}/evidence`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) setErr(d.error);
    setBusy(false);
    onChange();
  }

  async function review(action: "approve" | "reject") {
    setBusy(true);
    const r = await fetch(`${base}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    if (!r.ok) setErr(d.error);
    setBusy(false);
    onChange();
  }

  const v = ms.verification;
  const dec = ms.decision;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Milestone {index + 1}</p>
          <p className="text-lg font-semibold">
            {m.name} · ${ms.amountUsd.toFixed(2)} <span className="text-sm text-neutral-500">({m.percent}%)</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[ms.status]}`}>
          {STATUS_LABEL[ms.status]}
          {ms.releasedUsd !== undefined && ms.status !== "voided" ? ` · $${ms.releasedUsd.toFixed(2)}` : ""}
        </span>
      </div>

      <div className="mt-3 text-sm text-neutral-700">
        <p className="font-medium">Evidence required (auto-release at ≥{Math.round(m.autoReleaseMinConfidence * 100)}% confidence):</p>
        <ul className="mt-1 list-disc pl-5">
          {m.evidenceRequired.map((e) => (
            <li key={e.description}>
              <span className="uppercase text-neutral-500">[{e.type}]</span> {e.description}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-4">
        {ms.status === "awaiting_funding" && deal.status === "active" && role === "buyer" && (
          <div className="max-w-xs">
            <p className="mb-2 text-sm text-neutral-600">Fund this milestone. PayPal holds the money until the proof is verified.</p>
            <PayPalButtons
              style={{ layout: "horizontal", tagline: false }}
              createOrder={async () => {
                const r = await fetch(`${base}/order`, { method: "POST" });
                const d = await r.json();
                if (!r.ok) {
                  setErr(d.error);
                  throw new Error(d.error);
                }
                return d.orderId;
              }}
              onApprove={async (data) => {
                const r = await fetch(`${base}/authorize`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: data.orderID }),
                });
                const d = await r.json();
                if (!r.ok) setErr(d.error);
                onChange();
              }}
              onError={(e) => setErr(String(e))}
            />
          </div>
        )}
        {ms.status === "awaiting_funding" && deal.status === "active" && role === "seller" && (
          <p className="text-sm text-neutral-500">Waiting for the buyer to fund this milestone.</p>
        )}

        {ms.status === "funded" && role === "seller" && (
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
              📷 Capture proof (camera)
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && submitEvidence(e.target.files[0], true)}
              />
            </label>
            <label className="cursor-pointer rounded-full bg-neutral-100 px-4 py-2 text-sm">
              Upload file
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && submitEvidence(e.target.files[0], false)}
              />
            </label>
          </div>
        )}
        {ms.status === "funded" && role === "buyer" && (
          <p className="text-sm text-neutral-500">Funds held. Waiting for the seller&apos;s proof.</p>
        )}
        {busy && (
          <div className="mt-3 flex items-center gap-3 text-sm text-neutral-600">
            {preview && <img src={preview} alt="evidence" className="h-16 w-16 rounded-lg object-cover" />}
            AI is inspecting the evidence against the contract…
          </div>
        )}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {/* Verdict */}
      {v && dec && (
        <div className="mt-5 rounded-xl bg-neutral-50 p-4">
          <div
            className={`rounded-lg p-3 text-sm font-medium ${
              dec.action === "release"
                ? "bg-green-100 text-green-900"
                : dec.action === "partial_release"
                  ? "bg-lime-100 text-lime-900"
                  : dec.action === "block"
                    ? "bg-red-100 text-red-900"
                    : "bg-amber-100 text-amber-900"
            }`}
          >
            {dec.action === "release" && "✅ Auto-released. "}
            {dec.action === "partial_release" && `◐ Partial release $${dec.amountUsd.toFixed(2)}. `}
            {dec.action === "block" && "⛔ Blocked & voided. "}
            {dec.action === "review" && "⚠️ Sent to buyer for review. "}
            {dec.reason}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {v.checks.map((ch) => (
              <li key={ch.check} className="flex gap-3">
                <span className="w-5 shrink-0">{ch.result === "pass" ? "✅" : ch.result === "fail" ? "❌" : "❔"}</span>
                <span className="flex-1">
                  <b>{ch.check}</b>: <span className="text-neutral-600">{ch.observation}</span>
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-neutral-500">{Math.round(ch.confidence * 100)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-amber-500" style={{ width: `${v.overallConfidence * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Overall confidence {Math.round(v.overallConfidence * 100)}%
            {v.unitsExpected ? ` · units passing ${v.unitsPassed ?? 0}/${v.unitsExpected}` : ""}
          </p>
          {v.textFoundInImage && (
            <p className="mt-2 text-xs text-neutral-600">
              Text found in image (treated as data, never as instructions): <code>&quot;{v.textFoundInImage}&quot;</code>
            </p>
          )}
          {v.authenticityConcerns.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">Authenticity flags: {v.authenticityConcerns.join("; ")}</p>
          )}
          {ms.status === "in_review" && role === "buyer" && (
            <div className="mt-4 flex gap-3">
              <button disabled={busy} onClick={() => review("approve")} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                Approve &amp; release ${ms.amountUsd.toFixed(2)}
              </button>
              <button disabled={busy} onClick={() => review("reject")} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
                Reject &amp; void
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ledger({ deal }: { deal: DealView }) {
  const intact = deal.chainBrokenAt === -1;
  return (
    <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tamper-evident audit ledger</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${intact ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {intact ? `✓ Chain intact (${deal.log.length} entries)` : `✗ Chain broken at entry #${deal.chainBrokenAt}`}
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Every event is hashed with SHA-256 together with the previous entry&apos;s hash. Changing any past record breaks every hash after it.
      </p>
      <ol className="mt-4 space-y-2 font-mono text-xs">
        {deal.log.map((e) => (
          <li key={e.seq} className="rounded-lg bg-neutral-50 p-2">
            <span className="text-neutral-400">#{e.seq}</span> <b>{e.event}</b>{" "}
            <span className="text-neutral-500">{new Date(e.ts).toLocaleString()}</span>
            <div className="text-neutral-500">
              prev {short(e.prevHash)} → hash <span className="text-neutral-900">{short(e.hash)}</span>
            </div>
            <div className="truncate text-neutral-600">{JSON.stringify(e.data)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
