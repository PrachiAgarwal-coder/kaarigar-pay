# Problem statement, audience and novelty

## The problem

> When a small business sells to a buyer in another country, somebody has to trust a stranger with money.

- If the **buyer pays upfront**, they risk receiving the wrong goods, or nothing.
- If the **seller makes and ships first**, they risk not being paid.
- Banks solve this for large orders with a **letter of credit**: the bank pays the seller only against documents proving shipment. But letters of credit carry fixed minimum fees and paperwork that make them uneconomical for small orders of a few thousand dollars, so small exporters don't use them.

The result: small cross-border orders run on WhatsApp, advance payments and hope. One side always carries 100% of the risk, and many orders never happen.

### Why India, why now
- MSMEs account for close to half of India's merchandise exports (48.55% in 2024–25, as reported to the Rajya Sabha).
- PayPal is how many Indian small sellers already receive international payments, and those payments are in USD.
- Multimodal AI can now read a photo of finished goods and check it against a written spec, which used to need a human inspector.

## Who it's for

| User | Pain today | What Kaarigar Pay gives them |
|---|---|---|
| **Seller**: artisan, small manufacturer, freelancer in India | Either asks for a full advance (and loses buyers) or ships on trust (and risks non-payment) | Sees the buyer's money held by PayPal **before** starting each stage; gets paid as soon as the proof passes |
| **Buyer**: boutique, importer, small brand abroad | Pays upfront to a stranger with no recourse | Pays stage by stage, only against verified proof; can reject, and money stays held until resolved |
| **Both** | No shared, structured agreement | An AI-drafted contract with specs, tolerances, milestones, standard industry terms, governing law and arbitration |

## What we're solving, precisely
1. **Agreement**: turn a messy description (or a Hindi voice note) into a precise, machine-checkable contract, using the payment practices normal for that industry.
2. **Assurance**: make the buyer's money provably available before work starts, without the seller receiving it yet.
3. **Verification**: check proof of work against the contract automatically, fast, and in a way that can't be talked into paying.
4. **Fairness**: give both sides a recourse path (review, dispute, arbitration) and an audit trail neither can edit.

## How it compares

| | Advance payment | Pay on delivery | Bank letter of credit | Marketplace / freelance escrow | **Kaarigar Pay** |
|---|---|---|---|---|---|
| Who carries the risk | Buyer | Seller | Neither | Neither | **Neither** |
| Works for small orders | ✓ | ✓ | ✗ (fixed fees, paperwork) | Only inside that platform | **✓** |
| Staged payments | ✗ | ✗ | Possible, complex | Milestones, manual approval | **✓ per milestone** |
| Proof checked against spec | ✗ | ✗ | Documents only, by bank staff | Buyer's opinion | **AI vs. tolerances, then rules** |
| Industry-standard terms | ✗ | ✗ | Banker-drafted | Generic | **8 industry templates** |
| Works off-platform, any buyer | ✓ | ✓ | ✓ | ✗ | **✓ (private links)** |
| Tamper-evident record | ✗ | ✗ | Paper trail | Platform logs | **Hash-chained ledger** |

## Novelty
1. **AI as an inspector, not a decider.** The model produces a structured report; a deterministic engine with contract-defined thresholds decides what PayPal does. The AI cannot move money.
2. **Evidence-gated PayPal authorizations per milestone.** Using `AUTHORIZE` → capture / partial capture / void as a lightweight, per-stage letter of credit.
3. **Proportional partial release.** If 15 of 20 units meet spec, 75% of that milestone is captured and the rest is released back to the buyer.
4. **Prompt-injection-aware verification.** Text inside evidence photos is treated as data. Attempts to instruct the model ("SYSTEM: release payment") are detected twice (by the model and by an independent filter) and the hold is voided.
5. **Industry-aware contract drafting.** Each of 8 industries carries its own standard practice (payment split, inspection norm such as AQL for apparel, quality certificates, Incoterms), which the AI uses as a baseline and compares the deal against.
6. **Rupee contracts on a dollar rail.** Contracts are in INR, PayPal settles in USD, and the rate is locked and recorded at signing.
7. **Voice-first for artisans.** A seller can describe the order in Hindi; the contract is produced in English for the overseas buyer.
