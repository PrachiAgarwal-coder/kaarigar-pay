import { z } from "zod";

/** The machine-enforceable contract the AI drafts from a plain-language deal. */
export const SpecSchema = z.object({
  attribute: z.string(), // "length", "plating", "colour"
  target: z.string(), // "45 cm", "22k gold", "deep red"
  tolerance: z.string(), // "±2 mm", "none", "shade per reference photo"
  verifiableFromPhoto: z.boolean(),
});

export const EvidenceReqSchema = z.object({
  type: z.enum(["photo", "document", "tracking"]),
  description: z.string(),
  checks: z.array(z.string()).min(1), // what the AI verifies
});

export const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  percent: z.number(),
  evidenceRequired: z.array(EvidenceReqSchema).min(1),
  autoReleaseMinConfidence: z.number().min(0).max(1),
});

export const TermsSchema = z.object({
  paymentStructure: z.string().default(""), // "30% on materials, 50% on finished goods, 20% on shipment"
  incoterm: z.string().default(""),
  deliveryTimeline: z.string().default(""),
  inspection: z.string().default(""),
  qualityStandards: z.array(z.string()).default([]),
  returnsAndDefects: z.string().default(""),
  latePenalty: z.string().default(""),
  standardPracticeNote: z.string().default(""), // how this deal compares to the category norm
});

export const ContractSchema = z.object({
  title: z.string(),
  category: z.string().default("general"),
  terms: TermsSchema.default({
    paymentStructure: "", incoterm: "", deliveryTimeline: "", inspection: "",
    qualityStandards: [], returnsAndDefects: "", latePenalty: "", standardPracticeNote: "",
  }),
  buyer: z.object({ name: z.string(), country: z.string() }),
  seller: z.object({ name: z.string(), country: z.string() }),
  totalAmountInr: z.number().positive(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        specs: z.array(SpecSchema),
      })
    )
    .min(1),
  milestones: z.array(MilestoneSchema).min(1),
  buyerReviewHours: z.number(),
  allowPartialRelease: z.boolean(),
  governingLaw: z.string(),
  disputeResolution: z.string(),
});

export type Contract = z.infer<typeof ContractSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;

/** Make milestone percentages sum to exactly 100 and ids unique. */
export function normalizeContract(c: Contract): Contract {
  const sum = c.milestones.reduce((s, m) => s + m.percent, 0) || 1;
  let running = 0;
  const milestones = c.milestones.map((m, i) => {
    const isLast = i === c.milestones.length - 1;
    const pct = isLast ? 100 - running : Math.round((m.percent / sum) * 100);
    running += pct;
    return { ...m, id: `m${i + 1}`, percent: pct };
  });
  return { ...c, milestones };
}

export function milestoneAmount(c: Contract, m: Milestone): number {
  return Math.round((c.totalAmountInr * m.percent) / 100);
}

/** Plain-text shape description given to the model (no schema API needed). */
export const CONTRACT_SHAPE = `{
  "title": string,
  "category": string,
  "terms": { "paymentStructure": string, "incoterm": string, "deliveryTimeline": string, "inspection": string,
      "qualityStandards": [string], "returnsAndDefects": string, "latePenalty": string, "standardPracticeNote": string },
  "buyer": { "name": string, "country": string },
  "seller": { "name": string, "country": string },
  "totalAmountInr": number (Indian rupees),
  "items": [ { "name": string, "quantity": number,
      "specs": [ { "attribute": string, "target": string, "tolerance": string, "verifiableFromPhoto": boolean } ] } ],
  "milestones": [ { "id": string, "name": string, "percent": number,
      "evidenceRequired": [ { "type": "photo" | "document" | "tracking", "description": string, "checks": [string] } ],
      "autoReleaseMinConfidence": number between 0 and 1 } ],
  "buyerReviewHours": number,
  "allowPartialRelease": boolean,
  "governingLaw": string,
  "disputeResolution": string
}`;

/** FX: the contract lives in rupees; PayPal settles cross-border in USD (INR is not a PayPal
 * cross-border currency). The rate is locked when both parties sign. */
export const DEFAULT_FX_INR_PER_USD = Number(process.env.FX_INR_PER_USD ?? 88);
export const inrToUsd = (inr: number, rate: number) => Math.round((inr / rate) * 100) / 100;
export const formatInr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
