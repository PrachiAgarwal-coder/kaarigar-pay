# Architecture

Kaarigar Pay is a single Next.js application (App Router, TypeScript) that combines three things:

1. **PayPal** as the money rail: funds are *authorized* (held) per milestone and later *captured*, *partially captured* or *voided*.
2. **Google Gemini** as the AI layer: it drafts structured contracts and inspects evidence photos.
3. **A deterministic rule engine and a hash-chained ledger** that sit between the two, so the AI never moves money by itself.

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Client["Browser (Next.js client)"]
        L[Landing + industry picker]
        C[Contract workspace<br/>tabs: overview · terms · specs · milestones · audit]
        P[Printable contract PDF]
        PB[PayPal JS SDK buttons]
    end

    subgraph Server["Next.js route handlers (Node)"]
        API1["POST /api/contracts<br/>draft"]
        API2["POST /accept<br/>sign"]
        API3["POST /order · /authorize<br/>fund"]
        API4["POST /evidence<br/>verify + settle"]
        API5["POST /review · /dispute"]
        AUTH[Private-link auth<br/>x-kp-key]
        RULES[Decision engine<br/>deterministic]
        LEDGER[Hash-chained ledger<br/>SHA-256]
        STORE[(Deal store<br/>JSON + uploads)]
        CAT[Industry templates<br/>8 categories]
    end

    subgraph External["External services"]
        GEM[Google Gemini<br/>multimodal]
        PP[PayPal REST<br/>Orders v2 · Payments v2]
    end

    L --> API1
    C --> API2 & API3 & API4 & API5
    PB <--> PP
    PB --> API3
    API1 --> CAT
    API1 --> GEM
    API4 --> GEM
    API4 --> RULES
    RULES --> PP
    API5 --> PP
    API2 & API3 & API4 & API5 --> AUTH
    API1 & API2 & API3 & API4 & API5 --> LEDGER --> STORE
```

| Layer | Responsibility | Code |
|---|---|---|
| Industry templates | Standard payment splits, evidence, inspection norms, Incoterms for 8 industries | `src/lib/categories.ts` |
| Contract schema | Zod schema for the machine-enforceable contract; normalisation of milestone % | `src/lib/contract.ts` |
| AI drafting & verification | Prompts, multimodal calls, output validation, retry and fallback models | `src/lib/verify.ts`, `src/lib/gemini.ts` |
| Decision engine | Turns the AI report into release / partial release / review / block | `decide()` in `src/lib/verify.ts` |
| Money movement | PayPal OAuth, AUTHORIZE orders, capture, partial capture, void | `src/lib/paypal.ts`, `src/lib/settle.ts` |
| Access control | Private buyer/seller tokens; secrets stripped from responses | `src/lib/auth.ts` |
| Audit | Append-only SHA-256 hash chain + verification | `src/lib/ledger.ts` |
| Persistence | Serialised JSON store and evidence files | `src/lib/store.ts` |

---

## 2. End-to-end flow

```mermaid
sequenceDiagram
    autonumber
    actor S as Seller
    actor B as Buyer
    participant App as Kaarigar Pay
    participant AI as Gemini
    participant PP as PayPal

    S->>App: Industry + deal description (text or Hindi/English voice note)
    App->>AI: Industry template + deal → structured contract
    AI-->>App: JSON contract (specs, tolerances, milestones, evidence, clauses)
    App->>App: Validate with Zod, normalise %, ledger: contract_drafted
    S->>App: Sign (seller link)
    B->>App: Sign (buyer link)
    App->>App: SHA-256 of terms → locked, FX rate locked, ledger: contract_locked

    loop Each milestone
        B->>App: Fund milestone
        App->>PP: Create order (intent AUTHORIZE, USD at locked rate)
        B->>PP: Approve in PayPal popup
        App->>PP: Authorize order
        PP-->>App: Authorization ID (funds held)
        S->>App: Upload 1–4 evidence photos
        App->>App: SHA-256 each file, duplicate check
        App->>AI: Contract context (trusted) + images (untrusted)
        AI-->>App: Per-check verdicts, text found in image, injection flag
        App->>App: Decision engine (deterministic)
        alt All checks pass ≥ threshold
            App->>PP: Capture authorization
        else Some units fail, partial allowed
            App->>PP: Partial capture (final_capture)
        else Unsure / authenticity flags
            App-->>B: Buyer review (approve → capture, reject → dispute)
        else Injection or reused evidence
            App->>PP: Void authorization (money back to buyer)
        end
        App->>App: Ledger: evidence_submitted, ai_verdict, released / voided
    end
```

---

## 3. Milestone state machine

```mermaid
stateDiagram-v2
    [*] --> awaiting_funding
    awaiting_funding --> funded: buyer authorizes via PayPal
    funded --> released: AI pass ≥ threshold → capture
    funded --> partially_released: some units pass → partial capture
    funded --> in_review: unclear / low confidence / authenticity flag
    funded --> voided: injection attempt or reused evidence → void
    in_review --> released: buyer approves → capture
    in_review --> disputed: buyer rejects (funds stay held)
    disputed --> funded: seller resubmits evidence
    disputed --> voided: seller accepts refund → void
    disputed --> arbitration: seller escalates (funds stay held)
    released --> [*]
    partially_released --> [*]
    voided --> [*]
```

A contract is `completed` when every milestone is `released`, `partially_released` or `voided`.

---

## 4. Why the AI can't move money

```mermaid
flowchart TB
    IMG[Evidence images<br/>UNTRUSTED] --> AI[Gemini inspection]
    CTX[Contract context<br/>TRUSTED] --> AI
    AI --> R[Structured report<br/>validated by Zod]
    R --> D{Decision engine<br/>plain TypeScript}
    DUP[Duplicate file hash?] --> D
    RX[Regex injection filter<br/>on text found in image] --> D
    TH[Contract threshold<br/>autoReleaseMinConfidence] --> D
    D -->|release| CAP[PayPal capture]
    D -->|partial| PCAP[PayPal partial capture]
    D -->|review| BUY[Buyer decides]
    D -->|block| VOID[PayPal void]
```

- The model only **reports**. It has no tool access and cannot call PayPal.
- Images are marked as untrusted in the prompt; any text inside them is copied out as data.
- A **second, model-independent filter** scans that text for instruction-like patterns, so a jailbroken or mistaken model still can't release funds.
- Thresholds come from the signed contract, not from the model.

---

## 5. Data model

```mermaid
erDiagram
    DEAL ||--|| CONTRACT : has
    DEAL ||--|{ MILESTONE_STATE : tracks
    DEAL ||--|{ LEDGER_ENTRY : records
    CONTRACT ||--|{ ITEM : lists
    ITEM ||--|{ SPEC : "has (target + tolerance)"
    CONTRACT ||--|{ MILESTONE : defines
    MILESTONE ||--|{ EVIDENCE_REQ : requires
    MILESTONE_STATE ||--o{ EVIDENCE : receives

    DEAL {
        string id
        string status "draft | active | completed"
        string termsHash "SHA-256 of signed terms"
        number fxInrPerUsd "locked at signing"
        string buyerToken "secret, never sent to client"
        string sellerToken "secret, never sent to client"
    }
    MILESTONE_STATE {
        string status
        number amountInr
        number chargedUsd
        string paypalOrderId
        string paypalAuthorizationId
        string paypalCaptureId
        number releasedInr
    }
    LEDGER_ENTRY {
        number seq
        string event
        json data
        string prevHash
        string hash
    }
    EVIDENCE {
        string fileHash "SHA-256"
        number batch
        string mime
    }
```

---

## 6. PayPal integration

| Step | API | Notes |
|---|---|---|
| OAuth | `POST /v1/oauth2/token` | Client-credentials token, cached until expiry |
| Fund milestone | `POST /v2/checkout/orders` with `intent: AUTHORIZE` | One order per milestone; amount = milestone ₹ ÷ locked rate |
| Buyer approval | PayPal JS SDK `PayPalButtons` | Sandbox buyer logs in through the popup |
| Hold funds | `POST /v2/checkout/orders/{id}/authorize` | Returns the authorization ID stored on the milestone |
| Release | `POST /v2/payments/authorizations/{id}/capture` | Full capture |
| Partial release | same, with `amount` + `final_capture: true` | Pays only for units that pass; remainder is released back |
| Refund before capture | `POST /v2/payments/authorizations/{id}/void` | Used for blocked evidence and accepted refunds |

**Currency.** Contracts are denominated in INR. Indian PayPal accounts send and receive international payments in USD, so the INR→USD rate is fixed at signing and recorded in the ledger; only the PayPal order is in USD.

---

## 7. AI integration

| Task | Input | Output (validated) |
|---|---|---|
| Draft contract | Industry template + deal text and/or audio (Hindi/English) | `ContractSchema`: parties, items, specs with tolerances, milestones with evidence and checks, terms, governing law, arbitration |
| Verify evidence | Trusted contract context + 1–4 untrusted images | `VerificationSchema`: per-check pass/fail/unclear with confidence and observation, units passing, text found in image, injection flag, authenticity concerns |

Reliability: JSON-only responses, Zod validation with one automatic repair attempt for drafts, retries with exponential backoff on 429/500/503, and an ordered list of fallback models (`GEMINI_FALLBACK_MODELS`).

---

## 8. Security model

| Threat | Mitigation |
|---|---|
| Seller approves their own payment | Private-link tokens: buyer-only actions (fund, review) and seller-only actions (evidence, dispute) are checked server-side |
| Tokens leaking to the browser | `publicDeal()` strips tokens from every response |
| Prompt injection inside a photo | Untrusted-data prompt + model-reported `injectionAttempt` + independent regex filter → void |
| Reusing an old photo | SHA-256 of every file checked against all previous evidence |
| Editing history after the fact | Hash-chained ledger; `verifyChain()` reports the first broken entry, shown in the UI |
| Changing terms after signing | Terms hashed at signing; edits are rejected once the contract is active |
| AI hallucinating a pass | Release requires *every* check to pass *and* confidence ≥ the contract's threshold; otherwise a human decides |
