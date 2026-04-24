<div align="center">

<img src="public/leadflow-logo.svg" width="96" height="96" alt="LeadFlow OSS Engine logo" />

# LeadFlow OSS Engine

**Open-source lead discovery and outreach automation** — Gemini finds prospects, you review drafts, SMTP sends email. Optional **automatic** mode runs the loop for you.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)

</div>

---

## What this app does (in order)

Think of it as a small pipeline: **discover → enrich → draft → send → persist**.

### Step 1 — Deep search (lead discovery)

1. You set **location** (city/country) and **niche** (industry), then run search (or let auto-mode pick regions).
2. The app calls **Gemini with Google Search** to return a batch of businesses (names, sites, gaps, fit score, etc.).
3. Each result becomes a **lead** with a **personalized draft** email body and optional **email / phone** if the model finds them.
4. New leads land in the **New leads** section of the pipeline (newest first).

### Step 2 — Deep enrich (optional, per lead)

1. Open a lead (card or side panel).
2. Click **enrich** (search icon) next to the email field.
3. A second Gemini call tries to **fill or correct email and WhatsApp/phone** using the business name + website + location.
4. Use this when discovery returned no email or you want a better contact.

### Step 3 — Outreach

- **Email:** uses your **SMTP** settings; the UI sends HTML to `/api/email/send`.
- **WhatsApp:** if a phone exists, the app can open WhatsApp with the draft text.

### Step 4 — Status and storage

- After a successful email send, the lead is marked **contacted** and moves to **Contacted / older leads**.
- **Everything is saved to disk** as `leads_storage.json` in the project root (see [Local storage](#local-storage-vs-database) below).

---

## Manual vs automatic mode

| Mode | What happens |
|------|----------------|
| **Manual** | You choose when to search, who to open, when to send. Full control. Good for compliance review and testing copy. |
| **Automatic** | After discovery, the app can **queue outreach**: it waits a short **review window** on fresh leads, then sends SMTP to new leads that already have an email, with delays between sends. **Stop Auto** or switch back to Manual anytime. Header shows **Automation context** (hunting, sending, queue). |

**Important:** automatic email must align with your laws (consent, cold outreach rules). Use Manual until you trust your copy and SMTP limits.

---

## Local storage vs database

**Today (out of the box)**

- Leads are stored in **`leads_storage.json`** via `POST /api/leads/load` and `POST /api/leads/save`.
- That file is **gitignored** so your prospect list never ships in the repo by accident.
- Good for solo use, demos, and development.

**When you need more**

- For teams, backups, or scale, **replace the JSON file with your own backend**: same API shape (array of leads) backed by **PostgreSQL, MongoDB, Supabase**, etc.
- Implement load/save in `server.ts` (or a separate service) and keep the React app unchanged if you preserve the JSON structure.

---

## Configure it for *your* business (context & use case)

The AI “speaks as” whoever you define in code today.

1. **Agency / product story (what Gemini puts in drafts)**  
   Edit **`src/services/geminiService.ts`** — the **`BUSINESS_CONTEXT`** string and the rules inside **`discoverLeads`** / **`enrichLead`** prompts.  
   Replace services, tone, regions, offers (e.g. your audit, your SaaS, your consultancy). That is how you align outreach with **your** positioning.

2. **Geography & industries**  
   Adjust **`src/constants.ts`** (`AFRICAN_DIRECTORY`, `INDUSTRIES`) if your market is elsewhere or you want different city lists.

3. **Branding in the UI**  
   Use **`src/branding.ts`** defaults or override with **`VITE_*`** env vars (name, tagline, logo, footer). See the table below.

4. **Email identity**  
   Set **`SMTP_FROM_NAME`**, **`SMTP_FROM_EMAIL`** so recipients see *your* brand, not a generic default.

---

## Environment variables — fill these before real use

**Create an env file from the template and fill in what you use:**

```bash
copy .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

The dev server loads **`.env`** automatically (via `dotenv` in `server.ts`). You can keep extra Vite-only overrides in **`.env.local`** if you split client vs server vars.

> **Remember:** without **`GEMINI_API_KEY`** (and SMTP if you send email), discovery and outbound mail will not work. Never commit `.env`, `.env.local`, or real secrets.

### Required for AI search

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Authenticates Gemini. Required for discovery and deep enrich. Loaded for the dev server via Vite/env (see `vite.config.ts` / `server` setup). |

### Required for outbound email (optional if you only copy drafts)

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | Mail server hostname (e.g. Gmail, SendGrid, SES). |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL). |
| `SMTP_USER` | SMTP username. |
| `SMTP_PASS` | SMTP password or app password. |
| `SMTP_FROM_EMAIL` | Address shown as sender (often same as `SMTP_USER`). |
| `SMTP_FROM_NAME` | Display name (e.g. your company). |
| `SMTP_BCC` | Optional BCC on every send; leave empty for OSS/privacy. |

### Frontend branding (optional, Vite `VITE_*`)

| Variable | Example |
|----------|---------|
| `VITE_APP_NAME` | `LeadFlow OSS Engine` or your product name |
| `VITE_APP_TAGLINE` | One line under the title |
| `VITE_APP_LOGO_URL` | `/leadflow-logo.svg` or full URL to your logo |
| `VITE_APP_WEBSITE` | Repo or marketing site |
| `VITE_APP_FOOTER_TEXT` | Footer credit |
| `VITE_APP_VERSION` | e.g. `Community Edition v1.0.0` |

Default logo file: **`public/leadflow-logo.svg`** — swap the file or point `VITE_APP_LOGO_URL` elsewhere.

---

## Quick start

```bash
npm install
```

1. Copy `.env.example` → **`.env`** and **fill `GEMINI_API_KEY`** (and SMTP if you send mail).  
2. Run:

```bash
npm run dev
```

3. Open **http://localhost:3000** (Express + Vite in `server.ts`).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Express API + Vite middleware) |
| `npm run build` | Production client build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## Architecture (short)

| Layer | Role |
|-------|------|
| **React UI** (`src/`, mainly `LeadGenerator.tsx`) | Search form, pipeline sections, manual/auto, drafts, SMTP client calls. |
| **Express** (`server.ts`) | `/api/leads/load`, `/api/leads/save`, `/api/email/send`. |
| **Gemini** (`src/services/geminiService.ts`) | `discoverLeads`, `enrichLead` — **customize prompts and `BUSINESS_CONTEXT` here.** |

---

## Security & compliance

- Do not commit API keys or SMTP passwords.
- Respect **anti-spam** and **consent** rules in your jurisdiction before enabling automatic sends.
- Review drafts and throttle sends to protect your domain reputation.

---

## Contributing

Issues and PRs welcome. Keep changes focused and consistent with existing style.

---

## License

Apache-2.0 — SPDX headers in source files.

---

*LeadFlow OSS Engine is a community template: fork it, change prompts and branding, plug in your database when you outgrow JSON.*
