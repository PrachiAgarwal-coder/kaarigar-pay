import { NextResponse } from "next/server";
import { checkCredentials } from "@/lib/paypal";
import { geminiJSON } from "@/lib/gemini";


// Open http://localhost:3000/api/health first: confirms both keys work before you build anything else.
export async function GET() {
  const out: Record<string, string> = {};
  try {
    await checkCredentials();
    out.paypal = "ok";
  } catch (e) {
    out.paypal = (e as Error).message;
  }
  try {
    await geminiJSON("Reply with JSON only.", [{ text: 'Return {"ok":true}' }]);
    out.gemini = "ok";
  } catch (e) {
    out.gemini = (e as Error).message;
  }
  return NextResponse.json(out);
}
