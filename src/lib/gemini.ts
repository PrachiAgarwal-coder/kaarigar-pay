// Minimal Gemini REST client (text + images + audio), JSON output.
// Retries on overload (503/429/500) with backoff, then tries fallback models.
// .env.local: GEMINI_MODEL=<main model>   GEMINI_FALLBACK_MODELS=<model-a>,<model-b>

const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

function models(): string[] {
  const main = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [main, ...fallbacks.filter((m) => m !== main)];
}

async function callOnce(model: string, key: string, system: string, parts: Part[]) {
  const r = await fetch(`${URL_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function geminiJSON(system: string, parts: Part[]): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing in .env.local");

  let lastErr = "";
  for (const model of models()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { ok, status, data } = await callOnce(model, key, system, parts);
      if (ok) return parseJSON(data);
      lastErr = `${model} → ${status}: ${JSON.stringify(data).slice(0, 300)}`;
      console.warn(`[gemini] ${lastErr}`);
      if (status === 404) break; // model not available: go to next model
      if (!RETRYABLE.has(status)) throw new Error(`Gemini error: ${lastErr}`);
      await sleep(1500 * 2 ** attempt); // 1.5s, 3s, 6s
    }
  }
  throw new Error(`Gemini is overloaded right now, try again in a minute. (${lastErr})`);
}

function parseJSON(data: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }) {
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text as string)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`);
  }
}
