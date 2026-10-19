# Hackathon review and demo plan

## Product story

SupplyPilot is for independent cafés and coffee carts buying disposable cups and lids. A size mismatch can leave a buyer with supplies that do not work together, potentially requiring replacement, delaying service, or creating waste. The sample comparison makes this concrete without claiming measured savings: Harbor Supply's synthetic $92 basket pairs 12 oz cups with 16 oz lids; Cedar Goods' synthetic $102 basket pairs 12 oz cups with 12 oz lids. The $10 difference is only the difference between these invented quote totals, not a market price, verified loss, or savings claim.

The differentiator is an evidence trail plus a compatibility rule, not an autonomous buyer. The app exposes source quote text, extracted details, and missing or mismatched information. The server independently validates its synthetic offer catalog, calculates the total, and freezes an order snapshot. Gemini is optional and advisory: it may summarize supplied evidence, but cannot select an offer, set a price, approve a purchase, or change the basket. A person reviews, selects, and explicitly approves. Checkout is Sandbox-only.

## Meaningful progress represented in this working tree

This is a summary of the current files, not a claim about commit dates or authorship; this workspace has no Git metadata to audit.

1. Built a Compare → Review → Approve experience around synthetic supplier quote evidence.
2. Added stable server-side offer IDs and explicit item, size, quantity, price, and delivery details, including an intentionally incompatible cup/lid example.
3. Made server-side validation and price calculation authoritative; the browser submits an offer ID and human approval rather than a total.
4. Added immutable order snapshots and capture checks against the selected offer, USD currency, and exact snapshot total.
5. Kept AI advisory and optional, with distinct payment success, failure, cancellation, and pending experiences.
6. Added mocked payment tests, setup documentation, a visible MIT license, and an allowlisted submission-packaging script.

Preserve the original repository history when preparing a public repository. Do not recreate or imply history from this summary.

## Tools and setup

- Node.js 24 and npm run the local server, install frontend packages, run tests, and build the frontend.
- React and Vite implement and serve the browser interface; Vite produces the frontend production build.
- Node's built-in HTTP, crypto, and test modules support the local API, order state, and focused automated tests.
- PayPal Developer Platform is used only through the PayPal Sandbox API (`api-m.sandbox.paypal.com`) for test orders and capture. Use Sandbox merchant credentials and a Sandbox Personal buyer; never use live credentials or endpoints.
- Gemini `generateContent` is an optional evidence-summary aid. Use it only with a Free Tier project while billing is disabled; skip it if that condition is not met or the service is unavailable. Never submit confidential supplier data.
- `.env.example` documents variable names with blank values. Keep local credentials in `.env`; do not put `.env` or credential-bearing files in source control or the submission archive. The package script uses an explicit file allowlist and validates the ZIP.
- `LICENSE` is MIT. The app's quote and offer examples are original synthetic text; use your own screen recording and narration for a demo, and include third-party material only when you have permission.

For exact PowerShell commands and the local app URL, see [README.md](README.md). A Gemini request is not required to run the app. Do not enable billing, purchase credits, or switch to a paid service.

## Suggested video outline (2:30 maximum)

This is a recording plan, not a completed video. Keep the final cut under 3 minutes.

- **0:00–0:15 — Audience and stakes:** “A small café can receive cups and lids that do not fit.” Identify the quotes as synthetic.
- **0:15–0:45 — Compare:** Show the source text and side-by-side facts. Point out Harbor's 12 oz cups / 16 oz lids mismatch and missing or differing details.
- **0:45–1:15 — Review:** Show the compatibility rule and the Cedar matching sizes. Explain the synthetic $92 versus $102 totals as a tradeoff, not a claimed saving. If Gemini is unavailable or not verified, say the evidence comparison works without it; do not stage or invent an AI result.
- **1:15–1:35 — Human approval:** Select Cedar and explicitly approve the reviewed offer. Emphasize that the browser sends an offer ID and approval, not a price, and the server calculates the basket.
- **1:35–2:10 — Sandbox checkout:** If you choose to demonstrate checkout, use only a user-controlled Sandbox merchant/buyer flow and show the actual result. Do not record or reveal credentials. Never fake a successful capture or fabricate order/capture IDs; if end-to-end Sandbox behavior has not been verified, state that limitation instead of presenting it as working.
- **2:10–2:30 — Close:** Recap evidence-based checks, optional AI assistance, human control, and Sandbox-only payment. Keep the whole video below 3:00.

## Project requirements checklist

- **PayPal Developer Platform / free Sandbox — Incomplete.** `server/index.js` targets the Sandbox API and server tests mock PayPal calls, but no real Sandbox order/capture has been verified in this review. Remaining: owner-run, user-approved Sandbox end-to-end test; never use live endpoints.
- **Meaningful AI — Incomplete.** The Gemini path is optional and constrained to evidence summaries, but a real Gemini response has not been verified here. Remaining: if desired, test once only after confirming Free Tier with billing disabled; otherwise demonstrate the non-AI comparison without implying a live AI result.
- **Functional, documented application — Incomplete.** README documents setup and local commands; automated tests cover the server behavior. A clean production build and full interactive run have not been verified in this review. Remaining: run checks in a normal local Windows terminal and manually validate the browser flow.
- **Original work and hackathon progress — Incomplete.** This file records meaningful implementation milestones visible in the current source, without invented dates. There is no `.git` metadata in this workspace, so original history cannot be audited. Remaining: preserve the original Git history in the public repository and ensure the progress narrative is accurate to the team's work.
- **Tools, setup, and credential hygiene — Verified for local files; Git status incomplete.** README and this file document Node/npm, React/Vite, Gemini, and PayPal Sandbox; `.gitignore` excludes `.env` patterns and `.env.example` is blank. The packaging script allowlists files and checks the archive. There is no Git metadata here to verify tracked-file status. Remaining: inspect the repository's Git index before publishing.
- **Public repository, source/assets/instructions, and visible license — Not yet applicable.** Local source, instructions, packaging script, and MIT `LICENSE` are present; nothing has been published or uploaded. Remaining: after review, publish the complete permitted source and assets with the original history and license.
- **Under-3-minute functioning video with permitted materials — Incomplete.** A 2:30 outline is provided above, but no video has been recorded and end-to-end payment is unverified. Remaining: record a truthful app demo under 3 minutes using owned or permission-cleared material and actual results only.

## Judging criteria checklist

- **1. Technological implementation — Incomplete.** Server code fixes the Sandbox endpoint, calculates from a catalog, freezes an order snapshot, and validates capture; mocked tests cover key cases. Real PayPal and Gemini service behavior has not been tested in this review. Remaining: owner-run Sandbox checkout and optional Free Tier Gemini verification, then report results accurately.
- **2. Design and accessibility — Incomplete.** Compare → Review → Approve, navigable steps, and distinct success/failure/canceled/pending states are represented in the UI and have focused local tests. Remaining: keyboard/screen-reader and responsive browser walkthrough, plus verify state transitions in a full local run.
- **3. Potential impact — Incomplete.** The target audience is independent cafés and coffee carts, and the synthetic mismatch demonstrates a plausible operational risk. The price difference is explicitly not represented as real loss or savings. Remaining: validate the problem with intended users and cite permission-cleared evidence before making quantified impact claims.
- **4. Innovation — Incomplete.** The code combines source-backed compatibility checks, optional advisory AI, server-authoritative pricing, and human purchasing control. Live AI behavior remains unverified. Remaining: demonstrate the full experience without overstating AI capability and clearly distinguish AI suggestions from deterministic checks.
- **5. Presentation — Incomplete.** The timed outline supports a concise story, but the video and end-to-end Sandbox demonstration do not yet exist. Remaining: record and review a sub-3-minute video, protect account information, and use only material the team owns or has permission to use.

No judging outcome or prize is guaranteed.
