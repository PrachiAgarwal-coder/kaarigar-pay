"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

export default function Home() {
  const router = useRouter();
  const [catId, setCatId] = useState<string | null>(null);
  const [dealText, setDealText] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const cat = CATEGORIES.find((c) => c.id === catId);

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        setAudio(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone not available.");
    }
  }

  async function draft() {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("dealText", dealText);
      if (catId) fd.append("category", catId);
      if (audio) fd.append("audio", audio, "voice-note.webm");
      const r = await fetch("/api/contracts", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.push(`/c/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-600">Kaarigar Pay</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">A letter of credit for orders too small for a bank.</h1>
        <p className="mt-3 text-neutral-600">
          The buyer&apos;s money is held by PayPal and reaches the seller only after the seller uploads proof that the AI
          verifies against the contract.
        </p>
      </header>

      <ol className="mt-8 flex gap-6 text-sm">
        {["Choose category", "Describe the deal", "Sign, fund, deliver"].map((s, i) => {
          const active = (i === 0 && !cat) || (i === 1 && cat);
          return (
            <li key={s} className={`flex items-center gap-2 ${active ? "font-semibold text-neutral-900" : "text-neutral-400"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${active ? "bg-amber-600 text-white" : "bg-neutral-200"}`}>
                {i + 1}
              </span>
              {s}
            </li>
          );
        })}
      </ol>

      {/* Step 1: category */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCatId(c.id);
              setDealText("");
              setTimeout(() => document.getElementById("deal")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              catId === c.id ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200" : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 text-sm font-semibold">{c.name}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{c.tagline}</div>
          </button>
        ))}
      </section>

      {cat && (
               <section id="deal" className="mt-6 grid gap-6 md:grid-cols-5">
          {/* Standard practice */}
          <aside className="rounded-2xl bg-neutral-50 p-5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Standard practice · {cat.name}</p>
            <div className="mt-3 space-y-3">
              {cat.milestones.map((m, i) => (
                <div key={m.name} className="flex gap-3">
                  <div className="w-12 shrink-0 text-right text-lg font-bold text-amber-600">{m.percent}%</div>
                  <div>
                    <p className="text-sm font-medium">
                      {i + 1}. {m.name}
                    </p>
                    <p className="text-xs text-neutral-500">Proof: {m.evidence.join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-3 text-xs">
              <Row k="Inspection" v={cat.inspection} />
              <Row k="Standards" v={cat.qualityStandards.join("; ")} />
              <Row k="Shipping" v={cat.incoterm} />
              <Row k="Defects" v={cat.returnsAndDefects} />
            </dl>
            <p className="mt-3 text-[11px] text-neutral-400">Typical industry norms. The AI adapts them to your deal; both parties review before signing.</p>
          </aside>

          {/* Step 2: deal */}
          <div className="rounded-2xl border border-neutral-200 p-5 shadow-sm md:col-span-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold">Describe the deal</label>
              <button onClick={() => setDealText(cat.example)} className="text-sm text-amber-700 underline">
                Use example
              </button>
            </div>
            <textarea
              value={dealText}
              onChange={(e) => setDealText(e.target.value)}
              rows={9}
              placeholder="Seller, buyer, what exactly, quantity, price in ₹, any payment terms you've agreed, delivery time…"
              className="mt-3 w-full rounded-xl border border-neutral-300 p-4 text-sm outline-none focus:border-amber-500"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={toggleRecord}
                className={`rounded-full px-4 py-2 text-sm font-medium ${recording ? "bg-red-600 text-white" : "bg-neutral-100"}`}
              >
                {recording ? "■ Stop recording" : "🎙 Voice note (Hindi / English)"}
              </button>
              {audio && !recording && <span className="text-sm text-green-700">Voice note attached ✓</span>}
              <button
                onClick={draft}
                disabled={loading || (!dealText && !audio)}
                className="ml-auto rounded-full bg-amber-600 px-6 py-2.5 font-semibold text-white disabled:opacity-40"
              >
                {loading ? "Drafting contract…" : "Draft contract with AI →"}
              </button>
            </div>
            {loading && <p className="mt-3 text-xs text-neutral-500">Usually 15–45 seconds.</p>}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-neutral-500">{k}</dt>
      <dd className="text-neutral-800">{v}</dd>
    </div>
  );
}
