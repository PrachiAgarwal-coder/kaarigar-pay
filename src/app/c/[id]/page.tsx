"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { Deal, MilestoneState } from "@/lib/store";
import type { Milestone } from "@/lib/contract";
import { formatInr } from "@/lib/contract";
import { getCategory } from "@/lib/categories";
import { FileText } from "lucide-react";
import { CATEGORY_ICONS, Logo } from "@/components/brand";
import { CountUp } from "@/components/reveal";

type DealView = Omit<Deal, "buyerToken" | "sellerToken"> & {
  chainBrokenAt: number;
  viewerRole: "buyer" | "seller" | null;
  privateLinks: boolean;
};

// The acting party's private key is attached to every action request.
let currentKey = "";
const api = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...(currentKey ? { "x-kp-key": currentKey } : {}) } });
type Role = "buyer" | "seller";
type Tab = "overview" | "terms" | "specs" | "milestones" | "audit";

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  awaiting_funding: { label: "Awaiting funding", cls: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-300" },
  funded: { label: "Held by PayPal", cls: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  in_review: { label: "Buyer review", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  released: { label: "Released", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  partially_released: { label: "Partially released", cls: "bg-lime-100 text-lime-800", dot: "bg-lime-500" },
  voided: { label: "Refunded to buyer", cls: "bg-red-100 text-red-800", dot: "bg-red-500" },
  disputed: { label: "Disputed: funds held", cls: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  arbitration: { label: "In arbitration", cls: "bg-purple-100 text-purple-800", dot: "bg-purple-500" },
};

const short = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "");

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealView | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [keys, setKeys] = useState<{ buyer?: string; seller?: string }>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [openMs, setOpenMs] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Work out who is viewing: private link (?k=) and/or keys saved by the creator of this deal.
  useEffect(() => {
    let saved: { buyer?: string; seller?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(`kp:${id}`) ?? "{}");
    } catch {}
    const k = new URLSearchParams(window.location.search).get("k");
    (async () => {
      const r = await fetch(`/api/contracts/${id}${k ? `?k=${k}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return setError(d.error);
      const next = { ...saved };
      if (k && d.viewerRole) next[d.viewerRole as Role] = k;
      setKeys(next);
      setRole(d.viewerRole ?? (next.seller ? "seller" : next.buyer ? "buyer" : d.privateLinks ? null : "buyer"));
      setDeal(d);
    })();
  }, [id]);

  currentKey = role ? keys[role] ?? "" : "";

  const load = useCallback(async () => {
    const r = await api(`/api/contracts/${id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) setError(d.error);
    else setDeal(d);
  }, [id]);

  if (error) return <main className="p-10 text-red-600">{error}</main>;
  if (!deal) return <main className="p-10 text-neutral-500">Loading contract…</main>;

  const c = deal.contract;
  const cat = getCategory(c.category);
  const CatIcon = cat ? CATEGORY_ICONS[cat.id] : null;
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
      <div className="flex-1">
        <header className="relative overflow-hidden bg-ink text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Logo />
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/c/${id}/print`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  <FileText size={14} /> Contract PDF
                </a>
                {(() => {
                  const canSwitch = !deal.privateLinks || (keys.buyer && keys.seller);
                  if (!role)
                    return <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/70">👁 Read-only view</span>;
                  if (!canSwitch)
                    return (
                      <span className="rounded-full bg-saffron px-4 py-1.5 text-sm font-semibold text-ink">
                        You are the {role} · {role === "buyer" ? c.buyer.name : c.seller.name}
                      </span>
                    );
                  return (
                    <div className="flex items-center gap-2">
                      <span className="hidden text-xs text-white/50 md:block">Demo: act as</span>
                      <div className="flex rounded-full bg-white/10 p-1 text-sm">
                        {(["buyer", "seller"] as Role[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => setRole(r)}
                            className={`rounded-full px-3 py-1.5 transition sm:px-4 ${role === r ? "bg-white font-semibold text-ink" : "text-white/60 hover:text-white"}`}
                          >
                            {r === "buyer" ? "Buyer" : "Seller"}
                            <span className="hidden lg:inline"> · {r === "buyer" ? c.buyer.name : c.seller.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="pb-5 pt-3 md:pt-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {cat && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/80">
                    {CatIcon && <CatIcon size={13} />} {cat.name}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    deal.status === "draft"
                      ? "bg-saffron/20 text-saffron"
                      : deal.status === "active"
                        ? "bg-sky-400/15 text-sky-300"
                        : "bg-emerald-400/15 text-emerald-300"
                  }`}
                >
                  {deal.status === "draft" ? "Draft · awaiting signatures" : deal.status === "active" ? "Active" : "Completed"}
                </span>
              </div>
              <h1 className="mt-3 font-display text-[clamp(1.6rem,2.2vw+1rem,2.8rem)] font-semibold leading-tight tracking-tight">{c.title}</h1>
              <p className="mt-2 text-sm text-white/55">
                {c.seller.name}, {c.seller.country} <span className="mx-1 text-saffron">→</span> {c.buyer.name}, {c.buyer.country}
              </p>
            </div>

            <nav className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap rounded-t-xl px-3 py-2.5 text-sm transition sm:px-4 ${
                    tab === t.id ? "bg-cream font-semibold text-ink" : "text-white/60 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 py-5 sm:px-8 md:py-7 lg:px-12">
        <div key={tab} className="kp-fade">
          {tab === "overview" && <Overview deal={deal} role={role} keys={keys} onDone={load} goToMilestone={goToMilestone} />}
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
      </div>
    </PayPalScriptProvider>
  );
}

/* ----------------------------- Overview ----------------------------- */

function Overview({
  deal,
  role,
  keys,
  onDone,
  goToMilestone,
}: {
  deal: DealView;
  role: Role | null;
  keys: { buyer?: string; seller?: string };
  onDone: () => void;
  goToMilestone: (mid: string) => void;
}) {
  const c = deal.contract;
  const ms = c.milestones.map((m) => ({ m, s: deal.milestones[m.id] }));
  const sum = (f: (s: MilestoneState) => number) => ms.reduce((t, x) => t + f(x.s), 0);
  const released = sum((s) => s.releasedInr ?? 0);
  const held = sum((s) => (["funded", "in_review", "disputed", "arbitration"].includes(s.status) ? s.amountInr : 0));
  const refunded = sum((s) =>
    s.status === "voided" ? s.amountInr : s.status === "partially_released" ? s.amountInr - (s.releasedInr ?? 0) : 0
  );
  const pending = Math.max(0, c.totalAmountInr - released - held - refunded);
  const pct = (n: number) => `${(n / c.totalAmountInr) * 100}%`;

  // next action
  const next = ms.find((x) => ["awaiting_funding", "funded", "in_review", "disputed", "arbitration"].includes(x.s.status));
  let action: { who: Role | "both"; text: string; mid?: string } | null = null;
  if (deal.status === "draft") action = { who: "both", text: "Review the contract and sign it. Funding opens once both parties sign." };
  else if (next?.s.status === "awaiting_funding")
    action = { who: "buyer", text: `Fund “${next.m.name}” (${formatInr(next.s.amountInr)}). PayPal holds it until proof is verified.`, mid: next.m.id };
  else if (next?.s.status === "funded")
    action = { who: "seller", text: `Upload proof for “${next.m.name}”. Payment is released only after it passes verification.`, mid: next.m.id };
  else if (next?.s.status === "in_review")
    action = { who: "buyer", text: `Review the evidence for “${next.m.name}”. The AI wasn't confident enough to release automatically.`, mid: next.m.id };
  else if (next?.s.status === "disputed")
    action = { who: "seller", text: `The buyer rejected the proof for “${next.m.name}”. Funds are still held: resubmit evidence, accept the refund, or escalate.`, mid: next.m.id };
  else if (next?.s.status === "arbitration")
    action = { who: "both", text: `“${next.m.name}” is in arbitration under the contract's dispute clause. Funds stay held until it's resolved.`, mid: next.m.id };

  return (
    <div className="space-y-4">
      {/* Money */}
      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs text-neutral-500">Contract value</p>
            <p className="font-display text-[clamp(2rem,2vw+1.2rem,2.8rem)] font-semibold tracking-tight tabular-nums"><CountUp to={c.totalAmountInr} prefix="₹" /></p>
          </div>
          <p className="text-xs text-neutral-500">
            {c.seller.name} ({c.seller.country}) → {c.buyer.name} ({c.buyer.country})
          </p>
        </div>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="bg-neem transition-all duration-1000" style={{ width: pct(released) }} />
          <div className="bg-ink-2 transition-all duration-1000" style={{ width: pct(held) }} />
          <div className="bg-madder transition-all duration-1000" style={{ width: pct(refunded) }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Money color="bg-neem" label="Released to seller" v={released} />
          <Money color="bg-ink-2" label="Held by PayPal" v={held} />
          <Money color="bg-madder" label="Refunded to buyer" v={refunded} />
          <Money color="bg-neutral-300" label="Not yet funded" v={pending} />
        </div>
      </section>

      {/* Next action */}
      {deal.status === "draft" ? (
        <SignPanel deal={deal} role={role} onDone={onDone} />
      ) : action ? (
        <section
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ${
            action.who === role || action.who === "both" ? "bg-ink text-white" : "bg-white border border-black/5 shadow-sm"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold ${action.who === role || action.who === "both" ? "text-saffron" : "text-neutral-500"}`}>
              Next step · {action.who === role ? "your turn" : action.who === "both" ? "both parties" : `waiting for ${action.who}`}
            </p>
            <p className="mt-1 text-sm">{action.text}</p>
          </div>
          {action.mid && (
            <button onClick={() => goToMilestone(action!.mid!)} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${action.who === role || action.who === "both" ? "bg-saffron text-ink" : "bg-ink text-white"}`}>
              Open milestone
            </button>
          )}
        </section>
      ) : (
        <section className="rounded-2xl bg-green-50 p-5 text-sm text-green-900">✅ All milestones settled.</section>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink/60">Milestones</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {ms.map(({ m, s }, i) => (
            <li key={m.id}>
              <button
                onClick={() => goToMilestone(m.id)}
                className="w-full rounded-xl border border-black/5 bg-cream/60 p-3 text-left transition hover:border-black/20 hover:bg-white"
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

      {keys.buyer && keys.seller && <LinksCard id={deal.id} keys={keys} />}

      {deal.termsHash && (
        <p className="text-xs text-neutral-500">
          🔒 Signed by both parties · terms hash <code>{short(deal.termsHash)}</code> · rate locked at ₹{deal.fxInrPerUsd} = $1
        </p>
      )}
    </div>
  );
}

function LinksCard({ id, keys }: { id: string; keys: { buyer?: string; seller?: string } }) {
  const [copied, setCopied] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links: [string, string][] = [
    ["Buyer", `${origin}/c/${id}?k=${keys.buyer}`],
    ["Seller", `${origin}/c/${id}?k=${keys.seller}`],
  ];
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-ink/60">Private links</p>
      <p className="mt-1 text-xs text-neutral-500">
        Each party acts only through their own link: the seller can&apos;t approve payments, the buyer can&apos;t submit evidence.
      </p>
      <div className="mt-3 space-y-2">
        {links.map(([who, url]) => (
          <div key={who} className="flex items-center gap-2">
            <span className="w-14 text-xs font-semibold">{who}</span>
            <code className="flex-1 truncate rounded bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600">{url}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(url);
                setCopied(who);
                setTimeout(() => setCopied(""), 1500);
              }}
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs text-white"
            >
              {copied === who ? "Copied ✓" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </section>
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

function SignPanel({ deal, role, onDone }: { deal: DealView; role: Role | null; onDone: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function sign(party: Role) {
    setBusy(true);
    const name = party === "buyer" ? deal.contract.buyer.name : deal.contract.seller.name;
    const r = await api(`/api/contracts/${deal.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party, name }),
    });
    const d = await r.json();
    setErr(r.ok ? "" : d.error);
    setBusy(false);
    onDone();
  }
  return (
    <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <p className="text-xs font-semibold text-amber-800">Next step · sign the contract</p>
      <p className="mt-1 text-sm">
        Review the <b>Payment terms</b> and <b>Specifications</b> tabs. Once both sign, the terms are hashed and locked.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(["seller", "buyer"] as Role[]).map((p) =>
          deal.accepted[p] ? (
            <span key={p} className="rounded-full bg-green-100 px-4 py-1.5 text-sm text-green-800">
              ✓ {p} signed
            </span>
          ) : p !== role ? (
            <span key={p} className="rounded-full bg-white px-4 py-1.5 text-sm text-neutral-500 ring-1 ring-neutral-200">
              Waiting for {p}
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
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
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
    <div className="space-y-4">
      {(t.standardPracticeNote || cat) && (
        <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="text-xs font-semibold text-amber-800">
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
            <div key={k} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xs text-neutral-500">{k}</p>
              <p className="mt-1 text-sm">{v}</p>
            </div>
          ))}
        {t.qualityStandards.length > 0 && (
          <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm md:col-span-3">
            <p className="text-xs text-neutral-500">Quality standards</p>
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

      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink/60">How the money moves</p>
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

      <section className="rounded-2xl border border-black/5 bg-white p-5 text-sm shadow-sm">
        <p className="text-sm font-semibold text-ink/60">Legal</p>
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
        <section key={it.name} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="font-semibold">
            {it.quantity} × {it.name}
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
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
  role: Role | null;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [staged, setStaged] = useState<{ file: File; url: string; camera: boolean }[]>([]);
  const [revealed, setRevealed] = useState<number | null>(null); // null = show everything
  const base = `/api/contracts/${deal.id}/milestones/${m.id}`;
  const st = STATUS[ms.status];

  function addFiles(list: FileList | null, camera: boolean) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({ file, url: URL.createObjectURL(file), camera }));
    setStaged((s) => [...s, ...next].slice(0, 4));
  }

  async function submitEvidence() {
    if (!staged.length) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    staged.forEach((s) => fd.append("file", s.file));
    fd.append("capturedInApp", String(staged.every((s) => s.camera)));
    const r = await api(`${base}/evidence`, { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(d.error);
      return;
    }
    setStaged([]);
    // reveal checks one by one
    const n: number = d.verification?.checks?.length ?? 0;
    setRevealed(0);
    onChange();
    for (let i = 1; i <= n; i++) {
      await new Promise((res) => setTimeout(res, 700));
      setRevealed(i);
    }
    await new Promise((res) => setTimeout(res, 500));
    setRevealed(null);
  }

  async function respond(action: "accept_refund" | "escalate") {
    setBusy(true);
    const r = await api(`${base}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    if (!r.ok) setErr(d.error);
    setBusy(false);
    onChange();
  }

  async function review(action: "approve" | "reject") {
    setBusy(true);
    const r = await api(`${base}/review`, {
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
  const lastBatch = Math.max(0, ...ms.evidence.map((e) => e.batch ?? 0));
  const shown = ms.evidence.filter((e) => (e.batch ?? 0) === lastBatch);
  const imgs = shown.map((e) => `${base}/evidence?h=${e.fileHash.slice(0, 12)}`);
  const passed = v ? v.checks.filter((c) => c.result === "pass").length : 0;
  const total = v ? v.checks.length : 0;
  const animating = revealed !== null;

  return (
    <div className={`rounded-2xl border bg-white ${open ? "border-black/10 shadow-md" : "border-black/5 shadow-sm"}`}>
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
            <p className="text-sm font-semibold text-ink/60">Proof required to release payment</p>
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
                  const r = await api(`${base}/order`, { method: "POST" });
                  const d = await r.json();
                  if (!r.ok) {
                    setErr(d.error);
                    throw new Error(d.error);
                  }
                  return d.orderId;
                }}
                onApprove={async (data) => {
                  const r = await api(`${base}/authorize`, {
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

          {ms.status === "disputed" && role === "seller" && (
            <div className="rounded-xl bg-orange-50 p-4 text-sm">
              <p className="font-medium">The buyer rejected this proof. {formatInr(ms.amountInr)} is still held, not refunded yet.</p>
              <p className="mt-1 text-xs text-neutral-600">Resubmit better evidence below, accept the refund, or escalate under the contract&apos;s dispute clause.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => respond("escalate")} className="rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white">
                  Escalate to arbitration
                </button>
                <button disabled={busy} onClick={() => respond("accept_refund")} className="rounded-full bg-white px-4 py-2 text-xs ring-1 ring-neutral-300">
                  Accept refund
                </button>
              </div>
            </div>
          )}
          {ms.status === "disputed" && role === "buyer" && (
            <p className="rounded-xl bg-orange-50 p-4 text-sm">You rejected this proof. Funds stay held while the seller resubmits, accepts the refund, or escalates.</p>
          )}
          {ms.status === "arbitration" && (
            <p className="rounded-xl bg-purple-50 p-4 text-sm">
              ⚖️ Escalated to arbitration under: <i>{deal.contract.disputeResolution}</i>. Funds stay held; all evidence hashes are recorded in the audit log.
            </p>
          )}

          {(ms.status === "funded" || ms.status === "disputed") && role === "seller" && (
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-medium">{formatInr(ms.amountInr)} is held for you.</p>
              <p className="mb-3 text-xs text-neutral-600">
                Add photos covering every proof listed above (e.g. the goods <b>and</b> the invoice), up to 4. Released as soon as they pass verification.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm ring-1 ring-neutral-300">
                  📷 Camera
                  <input type="file" accept="image/*" capture="environment" hidden disabled={busy}
                    onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }} />
                </label>
                <label className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm ring-1 ring-neutral-300">
                  ＋ Add photos
                  <input type="file" accept="image/*" multiple hidden disabled={busy}
                    onChange={(e) => { addFiles(e.target.files, false); e.target.value = ""; }} />
                </label>
                {staged.length > 0 && (
                  <button onClick={submitEvidence} disabled={busy}
                    className="ml-auto rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                    {busy ? "Verifying…" : `Submit ${staged.length} photo${staged.length > 1 ? "s" : ""} for verification →`}
                  </button>
                )}
              </div>
              {staged.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {staged.map((s, i) => (
                    <div key={s.url} className="relative">
                      <img src={s.url} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-neutral-200" />
                      {!busy && (
                        <button onClick={() => setStaged((x) => x.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-neutral-900 text-xs text-white">×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {ms.status === "funded" && role === "buyer" && (
            <p className="rounded-xl bg-blue-50 p-4 text-sm">
              {formatInr(ms.amountInr)} held by PayPal. The seller gets it only after uploading proof that passes verification.
            </p>
          )}

          {busy && (
            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              AI is inspecting {staged.length} image{staged.length > 1 ? "s" : ""} against the contract…
            </div>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* Verdict */}
          {v && dec && (
            <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
              {animating ? (
                <div className="rounded-t-xl bg-neutral-100 p-3 text-sm font-medium text-neutral-700">
                  🔎 Checking {Math.min(revealed ?? 0, total)} of {total}…
                </div>
              ) : (
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
                {dec.action === "review" &&
                  (ms.status === "disputed"
                    ? "✋ Rejected by buyer after review. "
                    : ms.status === "arbitration"
                      ? "⚖️ Rejected by buyer, escalated to arbitration. "
                      : ms.status === "released"
                        ? "✅ Approved by buyer after review. "
                        : ms.status === "voided"
                          ? "↩︎ Refunded after review. "
                          : "⚠️ Sent to buyer for review. ")}
                <span className="font-normal">{dec.reason}</span>
              </div>
              )}
              <div className="flex flex-col gap-4 p-4 md:flex-row">
                {imgs.length > 0 && (
                  <div className="grid shrink-0 grid-cols-2 gap-2 md:w-40 md:grid-cols-1">
                    {imgs.map((src) => (
                      <img key={src} src={src} alt="evidence" className="h-36 w-full rounded-lg object-cover md:h-28" />
                    ))}
                  </div>
                )}
                <div className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {v.checks.map((ch, i) => {
                      const hidden = animating && i >= (revealed ?? 0);
                      return (
                      <li key={ch.check} className={`flex gap-3 transition-opacity duration-300 ${hidden ? "opacity-40" : "opacity-100"}`}>
                        <span className="w-5 shrink-0">{hidden ? "⏳" : ch.result === "pass" ? "✅" : ch.result === "fail" ? "❌" : "❔"}</span>
                        <span className="flex-1">
                          <b>{ch.check}</b>
                          {!hidden && <span className="block text-xs text-neutral-500">{ch.observation}</span>}
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                          {hidden ? "" : `${Math.round(ch.confidence * 100)}%`}
                        </span>
                      </li>
                      );
                    })}
                  </ul>
                  {!animating && (
                    <>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className={`h-full ${passed === total ? "bg-green-500" : passed === 0 ? "bg-red-500" : "bg-amber-500"}`}
                          style={{ width: `${total ? (passed / total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        <b>{passed} of {total} checks passed</b>
                        {v.unitsExpected ? ` · units meeting spec ${v.unitsPassed ?? 0}/${v.unitsExpected}` : ""}
                        <span className="text-neutral-400"> · AI certainty in this verdict {Math.round(v.overallConfidence * 100)}%</span>
                      </p>
                    </>
                  )}
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
              {!animating && ms.status === "in_review" && role === "buyer" && (
                <div className="flex gap-3 border-t border-neutral-100 p-4">
                  <button disabled={busy} onClick={() => review("approve")} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                    Approve & release {formatInr(ms.amountInr)}
                  </button>
                  <button disabled={busy} onClick={() => review("reject")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300">
                    Reject evidence
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
            <details className="rounded-xl border border-black/5 bg-white px-4 py-2.5">
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
