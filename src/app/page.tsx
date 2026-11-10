"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE = `Seller: Meera Handicrafts, Jaipur, India. Buyer: Olivia Brooks, Austin, USA.
Order: 20 pairs of handmade kundan jhumka earrings, 22k gold-plated brass, red meenakari enamel on the back,
3 kundan stones per earring, drop length 5 cm. Price $45 per pair, total $900.
Payment: 30% when raw materials are bought, 50% when all 20 pairs are finished, 20% when shipped with tracking.
Delivery in 3 weeks.`;

export default function Home() {
  const router = useRouter();
  const [dealText, setDealText] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);

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
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-600">Kaarigar Pay</p>
      <h1 className="mt-2 text-4xl font-bold leading-tight">A letter of credit for orders too small for a bank.</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Describe a cross-border order in plain words, or as a voice note in Hindi or English. AI turns it into a
        milestone contract. The buyer funds each milestone through PayPal, where the money is held, not taken. The
        seller uploads proof, and the AI checks it against the agreed specs before any money is released.
      </p>

      <div className="mt-10 rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <label className="font-semibold">Describe the deal</label>
          <button onClick={() => setDealText(EXAMPLE)} className="text-sm text-amber-700 underline">
            Use example
          </button>
        </div>
        <textarea
          value={dealText}
          onChange={(e) => setDealText(e.target.value)}
          rows={8}
          placeholder="Who is selling, who is buying, what exactly, how many, price, payment stages, delivery…"
          className="mt-3 w-full rounded-xl border border-neutral-300 p-4 text-sm outline-none focus:border-amber-500"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={toggleRecord}
            className={`rounded-full px-4 py-2 text-sm font-medium ${recording ? "bg-red-600 text-white" : "bg-neutral-100"}`}
          >
            {recording ? "■ Stop recording" : "🎙 Add voice note"}
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
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
