"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Deal } from "@/lib/store";
import { formatInr } from "@/lib/contract";
import { getCategory } from "@/lib/categories";

type DealView = Omit<Deal, "buyerToken" | "sellerToken"> & { chainBrokenAt: number };

export default function PrintContract() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealView | null>(null);

  useEffect(() => {
    fetch(`/api/contracts/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setDeal);
  }, [id]);

  if (!deal) return <main className="p-10 text-neutral-500">Preparing contract…</main>;
  const c = deal.contract;
  const t = c.terms;
  const cat = getCategory(c.category);
  const sig = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN") : "Not yet signed");
  const termRows: [string, string][] = [
    ["Payment structure", t?.paymentStructure],
    ["Shipping (Incoterm)", t?.incoterm],
    ["Delivery", t?.deliveryTimeline],
    ["Inspection", t?.inspection],
    ["Defects & returns", t?.returnsAndDefects],
    ["Late delivery", t?.latePenalty],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <main className="mx-auto max-w-3xl bg-white px-5 py-8 sm:px-10 text-[13px] leading-relaxed text-neutral-900 print:px-0 print:py-0">
      <div className="mb-6 flex justify-end gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white">
          Save as PDF / Print
        </button>
      </div>

      <header className="border-b-2 border-neutral-900 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron-dark">Kaarigar Pay · Milestone Trade Contract</p>
        <h1 className="mt-2 text-2xl font-bold">{c.title}</h1>
        <p className="mt-1 text-xs text-neutral-600">
          Contract ID {deal.id}
          {cat ? ` · ${cat.name}` : ""} · Drafted {new Date(deal.createdAt).toLocaleDateString("en-IN")}
          {deal.termsHash ? ` · Terms hash ${deal.termsHash.slice(0, 16)}…` : " · DRAFT, not yet signed"}
        </p>
      </header>

      <Section n="1" title="Parties">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase text-neutral-500">Seller</p>
            <p className="font-semibold">{c.seller.name}</p>
            <p>{c.seller.country}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500">Buyer</p>
            <p className="font-semibold">{c.buyer.name}</p>
            <p>{c.buyer.country}</p>
          </div>
        </div>
      </Section>

      <Section n="2" title="Goods and specifications">
        {c.items.map((it) => (
          <div key={it.name} className="mb-3">
            <p className="font-semibold">
              {it.quantity} × {it.name}
            </p>
            <table className="mt-1 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-300 text-xs uppercase text-neutral-500">
                  <th className="py-1 pr-3">Attribute</th>
                  <th className="pr-3">Target</th>
                  <th>Tolerance</th>
                </tr>
              </thead>
              <tbody>
                {it.specs.map((s) => (
                  <tr key={s.attribute} className="border-b border-neutral-100 align-top">
                    <td className="py-1 pr-3">{s.attribute}</td>
                    <td className="pr-3">{s.target}</td>
                    <td>{s.tolerance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {t?.qualityStandards?.length ? <p>Quality standards: {t.qualityStandards.join("; ")}.</p> : null}
      </Section>

      <Section n="3" title="Price and payment milestones">
        <p>
          Total contract value <b>{formatInr(c.totalAmountInr)}</b>. Amounts are denominated in Indian rupees; the buyer pays in USD
          through PayPal at the rate fixed on signing{deal.fxInrPerUsd ? ` (₹${deal.fxInrPerUsd} = US$1)` : ""}.
        </p>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-xs uppercase text-neutral-500">
              <th className="py-1 pr-2">#</th>
              <th className="pr-3">Milestone</th>
              <th className="pr-3">Share</th>
              <th className="pr-3">Amount</th>
              <th>Evidence required for release</th>
            </tr>
          </thead>
          <tbody>
            {c.milestones.map((m, i) => (
              <tr key={m.id} className="border-b border-neutral-100 align-top">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="pr-3">{m.name}</td>
                <td className="pr-3">{m.percent}%</td>
                <td className="pr-3">{formatInr(deal.milestones[m.id]?.amountInr ?? 0)}</td>
                <td>{m.evidenceRequired.map((e) => e.description).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n="4" title="Release of funds">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Before work on a milestone begins, the buyer funds it through PayPal. The funds are held (authorised) and not paid to the seller.</li>
          <li>Funds are released to the seller only after the seller submits the evidence listed in clause 3 and it is verified against the specifications in clause 2.</li>
          <li>
            Verification is performed automatically; evidence is released automatically only when all checks pass at or above the
            milestone&apos;s confidence threshold. Otherwise the buyer reviews it within {c.buyerReviewHours} hours.
          </li>
          <li>
            {c.allowPartialRelease
              ? "Where only part of a batch meets specification, payment is released in proportion to the units that pass."
              : "Partial release is not permitted."}
          </li>
          <li>Evidence that is reused or attempts to manipulate verification voids the milestone and the held funds are returned to the buyer.</li>
          <li>If the buyer rejects evidence, funds remain held while the seller resubmits, accepts a refund, or escalates under clause 6.</li>
        </ol>
      </Section>

      {termRows.length > 0 && (
        <Section n="5" title="Commercial terms">
          <dl className="grid grid-cols-[160px_1fr] gap-y-1">
            {termRows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {t?.standardPracticeNote && <p className="mt-2 text-neutral-600">Note on industry practice: {t.standardPracticeNote}</p>}
        </Section>
      )}

      <Section n="6" title="Governing law and disputes">
        <p>
          <b>Governing law:</b> {c.governingLaw}
        </p>
        <p>
          <b>Dispute resolution:</b> {c.disputeResolution}
        </p>
      </Section>

      <Section n="7" title="Signatures">
        <div className="grid grid-cols-2 gap-6">
          {(["seller", "buyer"] as const).map((p) => (
            <div key={p} className="border-t border-neutral-400 pt-2">
              <p className="font-semibold">{p === "seller" ? c.seller.name : c.buyer.name}</p>
              <p className="text-xs text-neutral-500">
                {p === "seller" ? "Seller" : "Buyer"} · electronically accepted: {sig(deal.accepted[p])}
              </p>
            </div>
          ))}
        </div>
        {deal.termsHash && (
          <p className="mt-3 break-all font-mono text-[10px] text-neutral-500">
            SHA-256 of signed terms: {deal.termsHash}. Any change to the terms produces a different hash.
          </p>
        )}
      </Section>

      <p className="mt-8 border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
        AI-drafted contract template generated by Kaarigar Pay for review by the parties. It is not legal advice; the parties should
        seek independent legal review before relying on it.
      </p>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
