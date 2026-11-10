// Minimal Gemini REST client (text + images + audio), JSON output.
// Model is configurable: set GEMINI_MODEL in .env.local if the default is retired.

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function geminiJSON(system: string, parts: Part[]): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing in .env.local");
  const r = await fetch(`${URL_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`);
  const text: string = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
    .map((p: { text: string }) => p.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    // tolerate ```json fences
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`);
  }
}
