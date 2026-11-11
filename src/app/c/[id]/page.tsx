"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { Deal, MilestoneState } from "@/lib/store";
import type { Milestone } from "@/lib/contract";
import { formatInr } from "@/lib/contract";
import { getCategory } from "@/lib/categories";

type DealView = Deal & { chainBrokenAt: number };
type Role = "buyer" | "seller";
type Tab = "overview" | "terms" | "specs" | "milestones" | "audit";

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  awaiting_funding: { label: "Awaiting funding", cls: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-300" },
  funded: { label: "Held by PayPal", cls: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  in_review: { label: "Buyer review", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  released: { label: "Released", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  partially_released: { label: "Partially released", cls: "bg-lime-100 text-lime-800", dot: "bg-lime-500" },
  voided: { label: "Refunded to buyer", cls: "bg-red-100 text-red-800", dot: "bg-red-500" },
};

const short = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "");

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealView | null>(null);
  const [role, setRole] = useState<Role>("buyer");
  const [tab, setTab] = useState<Tab>("overview");
  const [openMs, setOpenMs] = useState<string | null>(null);
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
  const cat = getCategory(c.category);
  const goToMilestone = (mid: string) => {
    setOpenMs(mid);
    setTab("milestones");
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "terms", label: "Payment terms" },
    { id: "specs", label: "Specifications" },
    { id: "milestones", label: `Milestones (${c.milestones.length})` },
    { id: "audit", label: "Audit log" },
  ];

  return (
    <PayPalScriptProvider
      options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "test", intent: "authorize", currency: "USD" }}
    >
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <a href="/" className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              ← Kaarigar Pay
            </a>
            <h1 className="mt-1 text-2xl font-bold leading-snug">{c.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {cat && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1">
                  {cat.icon} {cat.name}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  deal.status === "draft"
                    ? "bg-amber-100 text-amber-800"
                    : deal.status === "active"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                }`}
              >
                {deal.status === "draft" ? "Draft: awaiting signatures" : deal.status === "active" ? "Active" : "Completed"}
              </span>
            </div>
          </div>
          <div className="flex rounded-full bg-neutral-100 p-1 text-sm">
            {(["buyer", "seller"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full px-4 py-1.5 capitalize ${role === r ? "bg-white font-semibold shadow" : "text-neutral-500"}`}
              >
                {r === "buyer" ? `Buyer · ${c.buyer.name}` : `Seller · ${c.seller.name}`}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-neutral-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${
                tab === t.id ? "border-amber-600 font-semibold text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "overview" && <Overview deal={deal} role={role} onDone={load} goToMilestone={goToMilestone} />}
          {tab === "terms" && <Terms deal={deal} />}
          {tab === "specs" && <Specs deal={deal} />}
          {tab === "milestones" && (
            <div className="space-y-3">
              {c.milestones.map((m, i) => (
                <MilestoneItem
                  key={m.id}
                  index={i}
                  m={m}
                  ms={deal.milestones[m.id]}
                  deal={deal}
                  role={role}
                  open={openMs === m.id}
                  onToggle={() => setOpenMs(openMs === m.id ? null : m.id)}
                  onChange={load}
                />
              ))}
            </div>
          )}
          {tab === "audit" && <Ledger deal={deal} />}
        </div>
      </main>
    </PayPalScriptProvider>
  );
}

/* ----------------------------- Overview ----------------------------- */

function Overview({
  deal,
  role,
  onDone,
  goToMilestone,
}: {
  deal: DealView;
  role: Role;
  onDone: () => void;
  goToMilestone: (mid: string) => void;
}) {
  const c = deal.contract;
  const ms = c.milestones.map((m) => ({ m, s: deal.milestones[m.id] }));
  const sum = (f: (s: MilestoneState) => number) => ms.reduce((t, x) => t + f(x.s), 0);
  const released = sum((s) => s.releasedInr ?? 0);
  const held = sum((s) => (s.status === "funded" || s.status === "in_review" ? s.amountInr : 0));
  const refunded = sum((s) =>
    s.status === "voided" ? s.amountInr : s.status === "partially_released" ? s.amountInr - (s.releasedInr ?? 0) : 0
  );
  const pending = Math.max(0, c.totalAmountInr - released - held - refunded);
  const pct = (n: number) => `${(n / c.totalAmountInr) * 100}%`;

  // next action
  const next = ms.find((x) => ["awaiting_funding", "funded", "in_review"].includes(x.s.status));
  let action: { who: Role | "both"; text: string; mid?: string } | null = null;
  if (deal.status === "draft") action = { who: "both", text: "Review the contract and sign it. Funding opens once both parties sign." };
  else if (next?.s.status === "awaiting_funding")
    action = { who: "buyer", text: `Fund “${next.m.name}” (${formatInr(next.s.amountInr)}). PayPal holds it until proof is verified.`, mid: next.m.id };
  else if (next?.s.status === "funded")
    action = { who: "seller", text: `Upload proof for “${next.m.name}”. Payment is released only after it passes verification.`, mid: next.m.id };
  else if (next?.s.status === "in_review")
    action = { who: "buyer", text: `Review the evidence for “${next.m.name}”. The AI wasn't confident enough to release automatically.`, mid: next.m.id };

  return (
    <div className="space-y-6">
      {/* Money */}
      <section className="rounded-2xl border border-neutral-200 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Contract value</p>
            <p className="text-3xl font-bold">{formatInr(c.totalAmountInr)}</p>
          </div>
          <p className="text-xs text-neutral-500">
            {c.seller.name} ({c.seller.country}) → {c.buyer.name} ({c.buyer.country})
          </p>
        </div>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="bg-green-500" style={{ width: pct(released) }} />
          <div className="bg-blue-500" style={{ width: pct(held) }} />
          <div className="bg-red-400" style={{ width: pct(refunded) }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Money color="bg-green-500" label="Released to seller" v={released} />
          <Money color="bg-blue-500" label="Held by PayPal" v={held} />
          <Money color="bg-red-400" label="Refunded to buyer" v={refunded} />
          <Money color="bg-neutral-300" label="Not yet funded" v={pending} />
        </div>
      </section>

      {/* Next action */}
      {deal.status === "draft" ? (
        <SignPanel deal={deal} onDone={onDone} />
      ) : action ? (
        <section
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ${
            action.who === role ? "bg-amber-50 ring-1 ring-amber-200" : "bg-neutral-50"
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Next step · {action.who === role ? "your turn" : `waiting for ${action.who}`}
            </p>
            <p className="mt-1 text-sm">{action.text}</p>
          </div>
          {action.mid && (
            <button onClick={() => goToMilestone(action!.mid!)} className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white">
              Open milestone →
            </button>
          )}
        </section>
      ) : (
        <section className="rounded-2xl bg-green-50 p-5 text-sm text-green-900">✅ All milestones settled.</section>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Milestones</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {ms.map(({ m, s }, i) => (
            <li key={m.id}>
              <button
                onClick={() => goToMilestone(m.id)}
                className="w-full rounded-xl border border-neutral-200 p-3 text-left hover:border-neutral-400"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS[s.status].dot}`} />
                  <span className="text-xs text-neutral-500">Step {i + 1}</span>
                  <span className="ml-auto text-xs font-semibold">{m.percent}%</span>
                </div>
                <p className="mt-1 text-sm font-medium">{m.name}</p>
                <p className="text-xs text-neutral-500">
                  {formatInr(s.amountInr)} · {STATUS[s.status].label}
                </p>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {deal.termsHash && (
        <p className="text-xs text-neutral-500">
          🔒 Signed by both parties · terms hash <code>{short(deal.termsHash)}</code> · rate locked at ₹{deal.fxInrPerUsd} = $1
        </p>
      )}
    </div>
  );
}

function Money({ color, label, v }: { color: string; label: string; v: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </div>
      <p className="font-semibold">{formatInr(v)}</p>
    </div>
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
    <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Next step · sign the contract</p>
      <p className="mt-1 text-sm">
        Review the <b>Payment terms</b> and <b>Specifications</b> tabs. Once both sign, the terms are hashed and locked.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(["seller", "buyer"] as Role[]).map((p) =>
          deal.accepted[p] ? (
            <span key={p} className="rounded-full bg-green-100 px-4 py-1.5 text-sm text-green-800">
              ✓ {p} signed
            </span>
          ) : (
            <button
              key={p}
              disabled={busy}
              onClick={() => sign(p)}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm capitalize text-white disabled:opacity-40"
            >
              Sign as {p}
            </button>
          )
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Terms ------------------------------ */

function Terms({ deal }: { deal: DealView }) {
  const c = deal.contract;
  const t = c.terms ?? {
    paymentStructure: "", incoterm: "", deliveryTimeline: "", inspection: "",
    qualityStandards: [], returnsAndDefects: "", latePenalty: "", standardPracticeNote: "",
  };
  const cat = getCategory(c.category);
  const cards: [string, string][] = [
    ["Payment structure", t.paymentStructure],
    ["Shipping (Incoterm)", t.incoterm],
    ["Delivery", t.deliveryTimeline],
    ["Inspection", t.inspection],
    ["Defects & returns", t.returnsAndDefects],
    ["Late delivery", t.latePenalty],
  ];
  return (
    <div className="space-y-6">
      {(t.standardPracticeNote || cat) && (
        <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Compared with standard practice{cat ? ` · ${cat.name}` : ""}
          </p>
          {cat && <p className="mt-1 text-sm text-neutral-600">Industry norm: {cat.typicalPayment}</p>}
          {t.standardPracticeNote && <p className="mt-1 text-sm">{t.standardPracticeNote}</p>}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {cards
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs uppercase tracking-wider text-neutral-500">{k}</p>
              <p className="mt-1 text-sm">{v}</p>
            </div>
          ))}
        {t.qualityStandards.length > 0 && (
          <div className="rounded-xl border border-neutral-200 p-4 md:col-span-3">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Quality standards</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {t.qualityStandards.map((q) => (
                <li key={q} className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">How the money moves</p>
        <ol className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          {[
            ["Buyer funds", "Each milestone is paid into a PayPal hold. The seller can't touch it yet."],
            ["Seller proves", "The seller uploads the evidence the contract requires. No evidence, no payment."],
            ["AI verifies", `Every check is compared with the spec. Auto-release needs ≥${Math.round(
              Math.min(...c.milestones.map((m) => m.autoReleaseMinConfidence)) * 100
            )}% confidence.`],
            ["Money settles", `Passes → released. Unsure → buyer reviews (${c.buyerReviewHours}h window). Tampered → refunded.`],
          ].map(([h, d], i) => (
            <li key={h} className="rounded-xl bg-neutral-50 p-3">
              <p className="font-semibold">
                {i + 1}. {h}
              </p>
              <p className="mt-1 text-xs text-neutral-600">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          Partial release {c.allowPartialRelease ? "allowed (paid in proportion to units that pass)" : "not allowed"}. Amounts in ₹; the
          overseas buyer is charged in USD at the rate locked on signing{deal.fxInrPerUsd ? ` (₹${deal.fxInrPerUsd} = $1)` : ""}.
        </p>
      </section>

      <section className="rounded-2xl border border-neutral-200 p-5 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Legal</p>
        <p className="mt-2">
          <b>Governing law:</b> {c.governingLaw}
        </p>
        <p className="mt-1">
          <b>Disputes:</b> {c.disputeResolution}
        </p>
        <p className="mt-2 text-xs text-neutral-400">AI-drafted template for review by the parties. Not legal advice.</p>
      </section>
    </div>
  );
}

/* ------------------------------ Specs ------------------------------ */

function Specs({ deal }: { deal: DealView }) {
  return (
    <div className="space-y-4">
      {deal.contract.items.map((it) => (
        <section key={it.name} className="rounded-2xl border border-neutral-200 p-5">
          <p className="font-semibold">
            {it.quantity} × {it.name}
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="py-2">Attribute</th>
                <th>Target</th>
                <th>Tolerance</th>
                <th className="text-center">Photo check</th>
              </tr>
            </thead>
            <tbody>
              {it.specs.map((s) => (
                <tr key={s.attribute} className="border-t border-neutral-100 align-top">
                  <td className="py-2 pr-3 font-medium">{s.attribute}</td>
                  <td className="pr-3">{s.target}</td>
                  <td className="pr-3 text-neutral-600">{s.tolerance}</td>
                  <td className="text-center">{s.verifiableFromPhoto ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------- Milestones ---------------------------- */

function MilestoneItem({
  index,
  m,
  ms,
  deal,
  role,
  open,
  onToggle,
  onChange,
}: {
  index: number;
  m: Milestone;
  ms: MilestoneState;
  deal: DealView;
  role: Role;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const base = `/api/contracts/${deal.id}/milestones/${m.id}`;
  const st = STATUS[ms.status];

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
  const imgSrc = preview ?? (ms.evidence.length ? `${base}/evidence?f=${ms.evidence[ms.evidence.length - 1].fileHash.slice(0, 8)}` : null);

  return (
    <div className={`rounded-2xl border ${open ? "border-neutral-300 shadow-sm" : "border-neutral-200"}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${st.dot}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{m.name}</p>
          <p className="text-xs text-neutral-500">
            {formatInr(ms.amountInr)} · {m.percent}%
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>
          {st.label}
          {ms.status === "partially_released" && ms.releasedInr !== undefined ? ` · ${formatInr(ms.releasedInr)}` : ""}
        </span>
        <span className="text-neutral-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-100 p-5">
          {/* Evidence required */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Proof required to release payment</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {m.evidenceRequired.map((e) => (
                <li key={e.description} className="flex gap-2">
                  <span className="mt-0.5 rounded bg-neutral-100 px-1.5 text-[10px] font-semibold uppercase text-neutral-500">{e.type}</span>
                  <span>{e.description}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-neutral-500">Auto-release at ≥{Math.round(m.autoReleaseMinConfidence * 100)}% confidence; otherwise the buyer reviews.</p>
          </div>

          {/* Actions */}
          {deal.status === "draft" && <p className="text-sm text-neutral-500">Sign the contract first (Overview tab).</p>}

          {ms.status === "awaiting_funding" && deal.status === "active" && role === "buyer" && (
            <div className="max-w-sm rounded-xl bg-neutral-50 p-4">
              <p className="text-sm font-medium">Fund {formatInr(ms.amountInr)}</p>
              <p className="mb-3 mt-0.5 text-xs text-neutral-500">
                Held by PayPal and released to the seller only after verified proof. Charged in USD at ₹{deal.fxInrPerUsd ?? 88} = $1
                {ms.chargedUsd ? ` ($${ms.chargedUsd.toFixed(2)})` : ""}.
              </p>
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
            <p className="text-sm text-neutral-500">Waiting for the buyer to fund this milestone. Don&apos;t start work until it&apos;s held.</p>
          )}

          {ms.status === "funded" && role === "seller" && (
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-medium">{formatInr(ms.amountInr)} is held for you.</p>
              <p className="mb-3 text-xs text-neutral-600">Upload the proof above. It&apos;s released as soon as it passes verification.</p>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
                  📷 Capture with camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    disabled={busy}
                    onChange={(e) => e.target.files?.[0] && submitEvidence(e.target.files[0], true)}
                  />
                </label>
                <label className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm ring-1 ring-neutral-300">
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy}
                    onChange={(e) => e.target.files?.[0] && submitEvidence(e.target.files[0], false)}
                  />
                </label>
              </div>
            </div>
          )}
          {ms.status === "funded" && role === "buyer" && (
            <p className="rounded-xl bg-blue-50 p-4 text-sm">
              {formatInr(ms.amountInr)} held by PayPal. The seller gets it only after uploading proof that passes verification.
            </p>
          )}

          {busy && (
            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
              {preview && <img src={preview} alt="evidence" className="h-14 w-14 rounded-lg object-cover" />}
              Inspecting evidence against the contract…
            </div>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* Verdict */}
          {v && dec && (
            <div className="rounded-xl border border-neutral-200">
              <div
                className={`rounded-t-xl p-3 text-sm font-medium ${
                  dec.action === "release"
                    ? "bg-green-100 text-green-900"
                    : dec.action === "partial_release"
                      ? "bg-lime-100 text-lime-900"
                      : dec.action === "block"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-100 text-amber-900"
                }`}
              >
                {dec.action === "release" && "✅ Verified & released. "}
                {dec.action === "partial_release" && `◐ Partially released: ${formatInr(dec.amountInr)}. `}
                {dec.action === "block" && "⛔ Blocked & refunded. "}
                {dec.action === "review" && "⚠️ Sent to buyer for review. "}
                <span className="font-normal">{dec.reason}</span>
              </div>
              <div className="flex gap-4 p-4">
                {imgSrc && <img src={imgSrc} alt="evidence" className="hidden h-36 w-36 shrink-0 rounded-lg object-cover md:block" />}
                <div className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {v.checks.map((ch) => (
                      <li key={ch.check} className="flex gap-3">
                        <span className="w-5 shrink-0">{ch.result === "pass" ? "✅" : ch.result === "fail" ? "❌" : "❔"}</span>
                        <span className="flex-1">
                          <b>{ch.check}</b>
                          <span className="block text-xs text-neutral-500">{ch.observation}</span>
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                          {Math.round(ch.confidence * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full bg-amber-500" style={{ width: `${v.overallConfidence * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Overall confidence {Math.round(v.overallConfidence * 100)}%
                    {v.unitsExpected ? ` · units passing ${v.unitsPassed ?? 0}/${v.unitsExpected}` : ""}
                  </p>
                  {v.textFoundInImage && (
                    <p className="mt-2 text-xs text-neutral-600">
                      Text in image (treated as data, never instructions): <code>&quot;{v.textFoundInImage}&quot;</code>
                    </p>
                  )}
                  {v.authenticityConcerns.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700">Authenticity flags: {v.authenticityConcerns.join("; ")}</p>
                  )}
                </div>
              </div>
              {ms.status === "in_review" && role === "buyer" && (
                <div className="flex gap-3 border-t border-neutral-100 p-4">
                  <button disabled={busy} onClick={() => review("approve")} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                    Approve & release {formatInr(ms.amountInr)}
                  </button>
                  <button disabled={busy} onClick={() => review("reject")} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
                    Reject & refund
                  </button>
                </div>
              )}
              {ms.status === "in_review" && role === "seller" && (
                <p className="border-t border-neutral-100 p-4 text-sm text-neutral-600">Waiting for the buyer&apos;s decision.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Audit ------------------------------ */

function Ledger({ deal }: { deal: DealView }) {
  const intact = deal.chainBrokenAt === -1;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-600">
          Every event is hashed (SHA-256) together with the previous entry&apos;s hash, so editing any past record breaks the chain.
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${intact ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {intact ? `✓ Chain intact · ${deal.log.length} entries` : `✗ Chain broken at #${deal.chainBrokenAt}`}
        </span>
      </div>
      <ol className="mt-4 space-y-2">
        {deal.log.map((e) => (
          <li key={e.seq}>
            <details className="rounded-xl border border-neutral-200 px-4 py-2.5">
              <summary className="flex cursor-pointer items-center gap-3 text-sm">
                <span className="w-6 text-xs text-neutral-400">#{e.seq}</span>
                <span className="font-medium">{e.event.replaceAll("_", " ")}</span>
                <span className="ml-auto font-mono text-xs text-neutral-400">{short(e.hash)}</span>
                <span className="text-xs text-neutral-400">{new Date(e.ts).toLocaleTimeString()}</span>
              </summary>
              <div className="mt-2 space-y-1 font-mono text-xs text-neutral-600">
                <p>prev {e.prevHash}</p>
                <p>hash {e.hash}</p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-neutral-50 p-2">{JSON.stringify(e.data, null, 2)}</pre>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
