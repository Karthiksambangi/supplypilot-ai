# SupplyPilot AI

A local prototype for comparing synthetic supplier quotes with Gemini and approving a reviewed synthetic supplier offer for PayPal Sandbox checkout. Prices and totals come from the server-side offer catalog; no live payments are intended.

See [HACKATHON.md](HACKATHON.md) for the project progress summary, tool roles, judging checklist, and a truthful under-3-minute demo outline.

The demo guides a human through **Compare → Review → Approve**. It shows the source quote text beside extracted supplier facts and flags cup/lid compatibility issues. Gemini is optional and can only provide an evidence summary; it cannot approve a purchase or change the basket.

## Requirements

- Node.js 24 and npm.
- A PayPal Developer **Sandbox** app with Sandbox merchant credentials and a Sandbox Personal buyer account. Use Sandbox credentials only; never use live credentials or live checkout.
- If using Gemini, use a model available to your key on the Free Tier and keep billing disabled. Do not enable billing or purchase credits. Confirm the project remains Free Tier with billing disabled before making a Gemini request.

## Setup (Windows PowerShell)

Open PowerShell in this project folder and install the client dependencies:

```powershell
npm --prefix client install
```

Create `.env` from the example only if you do not already have one. Never overwrite an existing `.env`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set the PayPal Sandbox app's Client ID and Secret, plus Gemini settings if needed, in your local `.env`. Keep credentials private and never commit or include `.env` in a submission archive. `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`.

To create a submission archive, run `./scripts/package-submission.ps1`. It packages an allowlist of source and setup files, includes only the blank credential placeholders in `.env.example`, and validates that `.env`, credential-bearing `.env.*` files, and `node_modules` are absent. The generated ZIP is also ignored by Git.

Use two PowerShell terminals in this folder:

```powershell
# Terminal 1: backend
npm run dev
```

```powershell
# Terminal 2: frontend
npm run client
```

Open **http://127.0.0.1:5173** (not `localhost`; the configured client origin must match the browser URL). Review the synthetic catalog offer, choose a compatible one, and explicitly approve it before continuing to PayPal Sandbox. The browser submits only the selected offer ID and approval; the server validates the offer, calculates its total, and freezes a snapshot for order creation and capture validation. Use only the Sandbox Personal buyer account on PayPal's Sandbox approval page. Never use live credentials or live checkout. Gemini analysis is optional and cannot select an offer, set a price, authorize a purchase, or change the basket.

## Checks

```powershell
npm test
npm run build
```

## Demo boundaries

- Demo quotes and catalog offers are synthetic. Editing quote text changes only its comparison/analysis, not catalog data or prices.
- Harbor Supply is intentionally incompatible (12 oz cups with 16 oz lids) and the server rejects it. Cedar Goods has matching 12 oz items and can be selected after human review.
- The approved catalog snapshot—not Gemini output or a client-supplied total—sets PayPal's order items and total. Capture must confirm the same offer, amount, and USD currency before success is shown.
- Approval and order state live in server memory. Restarting the Node server during checkout loses that state; start a new checkout after restart.
- A single local developer is assumed. Do not expose this starter server publicly. Before hosting or sharing publicly, add authentication, persistent order storage, CSRF protection, and thorough payment reconciliation.

## API references

- PayPal Orders v2: https://developer.paypal.com/platforms/checkout/standard/integrate
- Gemini `generateContent`: https://ai.google.dev/api/generate-content

License: MIT. See `LICENSE`.
