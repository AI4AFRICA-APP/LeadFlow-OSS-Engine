<div align="center">

<img src="public/leadflow-logo.svg" width="96" height="96" alt="LeadFlow OSS Engine logo" />

# LeadFlow OSS Engine

**Open-source lead discovery and outreach automation** — search with Gemini, review drafts, send via SMTP, with optional automatic outreach.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)

</div>

## Features

- **Lead discovery** — Gemini-powered search with enrichment hooks.
- **Pipeline UI** — separate **New leads** vs **Contacted / older** sections.
- **Email** — SMTP via Express (`/api/email/send`); configurable sender and optional BCC.
- **Persistence** — local JSON store (`leads_storage.json`, gitignored).
- **Branding** — env-driven name, tagline, logo URL (`src/branding.ts`).

## Prerequisites

- **Node.js** 18+
- **Gemini API key** ([Google AI Studio](https://aistudio.google.com/))
- **SMTP** credentials if you use email sending

## Quick start

```bash
npm install
```

Copy environment template and fill values:

```bash
copy .env.example .env.local
```

On macOS/Linux use `cp .env.example .env.local`.

Required for discovery:

- `GEMINI_API_KEY`

For outbound email:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` (optional)
- `SMTP_BCC` (optional; omit for public deployments)

Optional UI branding (Vite):

| Variable | Example |
|----------|---------|
| `VITE_APP_NAME` | `LeadFlow OSS Engine` |
| `VITE_APP_TAGLINE` | `Lead discovery and outreach automation` |
| `VITE_APP_LOGO_URL` | `/leadflow-logo.svg` or your CDN URL |
| `VITE_APP_WEBSITE` | Your repo or site URL |
| `VITE_APP_FOOTER_TEXT` | Credit line in footer |
| `VITE_APP_VERSION` | `Community Edition v1.0.0` |

Default logo ships at **`public/leadflow-logo.svg`** — replace it or point `VITE_APP_LOGO_URL` at your own asset.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Express + Vite middleware) |
| `npm run build` | Production client build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

Dev server listens on **port 3000** by default (`server.ts`).

## Architecture (short)

- **Frontend:** React + Vite + Tailwind (`src/`)
- **API:** Express — lead load/save, SMTP send (`server.ts`)
- **AI:** `@google/genai` (`src/services/geminiService.ts`)

## Security & compliance

- Never commit `.env` or real API keys.
- **Opt-in** automatic email; respect local anti-spam and consent laws.
- Review drafts before enabling automation in production.

## Contributing

Issues and PRs welcome. Keep changes focused and match existing code style.

## License

Apache-2.0 — SPDX headers in source files.

---

*LeadFlow OSS Engine is a community project. Customize branding via env vars for your own deployment.*
