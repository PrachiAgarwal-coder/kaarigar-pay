# Evaluation

How we measure whether Kaarigar Pay does its job: **pay the seller quickly when the work is real, and never pay when it isn't.**

## 1. Automated tests (run on every change)

```bash
npm test
```

19 unit tests cover the parts that decide where money goes. These run without any API keys.

| Area | What is tested | Result |
|---|---|---|
| Decision engine (`decide`) | Release only when every check passes at or above the contract's threshold; review on unclear checks, low confidence or authenticity flags; block on model-flagged injection; **block on injection text even when the model misses it** (4 attack phrasings); **no false blocks** on ordinary text such as invoice headers and labels; block on reused evidence; proportional partial release (15/20 units → ₹28,500 of ₹38,000); review instead of partial release when partial release isn't allowed | 10 / 10 pass |
| Ledger (`verifyChain`) | Intact chain verifies; editing a past entry is detected at that entry; deleting an entry is detected; every entry links to the previous hash | 4 / 4 pass |
| Contract & access | Milestone % normalised to exactly 100 with unique ids; amounts in whole rupees; INR→USD at locked rate (₹22,800 at ₹88 = $259.09); private-link tokens map to the right party; buyer-only actions refuse the seller's key; secrets stripped before reaching the browser | 5 / 5 pass |
| **Total** | | **19 / 19 pass** |

## 2. End-to-end checks (manual, PayPal sandbox)

| Scenario | Expected | Verified |
|---|---|---|
| Draft → sign both → fund with sandbox buyer | Milestone shows *Held by PayPal*; ledger shows `funded` with the PayPal authorization ID | ✓ |
| AI unsure (no invoice in photo) → buyer approves | PayPal capture, milestone *Released*, money bar green | ✓ |
| Buyer rejects → seller escalates | Funds stay held; status *In arbitration*; ledger records the clause and evidence hashes | ✓ |
| Seller tries a buyer-only action | Rejected: "Only the buyer can do this" | ✓ |
| Gemini overloaded (HTTP 503) | Automatic retries, then fallback model | ✓ |

## 3. Verification quality metrics

The AI's job is inspection. We evaluate it with a labelled set of evidence photos (`evals/cases.json`) run through the **real pipeline** (Gemini → `decide()`):

```bash
GEMINI_API_KEY=... npx tsx scripts/eval-verify.ts
```

| Metric | Definition | Why it matters | Target |
|---|---|---|---|
| **False release rate** | Cases that should *not* be paid (fake, incomplete or tampered) but were released | The single most important number: money leaving wrongly is the failure that destroys trust | **0%** |
| **Attack block rate** | Prompt-injection / reused-evidence cases that ended in *block* | Measures resistance to deliberate cheating | 100% |
| **Genuine auto-release rate** | Genuine, complete proof released without a human | Measures how much manual review the AI saves; low values mean slow payments | ≥ 80% |
| **Decision accuracy** | Cases where the final action matches the label | Overall correctness | ≥ 90% |
| **Per-check precision / recall** | Agreement of each pass/fail with a human label | Finds which kinds of spec the AI misreads (e.g. counts, measurements) | Tracked per industry |
| **Median verification latency** | Upload to verdict | Seller experience | < 30 s |

**Design choice:** the thresholds are deliberately asymmetric. A wrong *review* costs the buyer a click; a wrong *release* costs real money. So anything uncertain goes to a human, and only unanimous, high-confidence passes are released automatically.

## 4. Business metrics (for a pilot)

| Metric | Definition |
|---|---|
| Time to payment | Proof uploaded → seller paid, per milestone |
| Dispute rate | Milestones rejected by the buyer ÷ milestones funded |
| Escalation rate | Disputes escalated to arbitration ÷ disputes |
| Advance-free orders | Orders completed with no unsecured advance from either side |
| Repeat trade | Buyer–seller pairs that sign a second contract |
| Cost per contract | AI calls + PayPal fees per completed contract, compared with a bank letter of credit |
