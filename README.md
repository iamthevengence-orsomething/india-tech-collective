# The India Tech Collective

**Open source. Open democracy.**

A volunteer, non-partisan community curating open-source technology for digital rights, civic participation, and government accountability in India — grounded in Article 19 of the Constitution (freedom of speech, expression, and peaceful assembly).

**Live at [indiatechcollective.org](https://www.indiatechcollective.org)** — a manifesto landing page in the register of a constitutional preamble, with three Parts: the open-source **Toolkit** (Part I), and two public accountability dashboards, **Politician Cases** (Part II) and **Corruption Data** (Part III). Astro static site, reproducible data pipeline, no trackers.

## The Parts

- **`/toolkit` — Part I.** Twenty-seven open-source tools for speech under pressure, each linking to its official source.
- **`/politicians` — Part II, Politician Cases.** Criminal cases self-declared by winners of the 2024 Lok Sabha election in their sworn Form 26 affidavits: searchable and filterable, with per-representative profiles (543 pages), visible numerators/denominators, statute mappings, compare mode, CSV/JSON downloads and deep-linkable filters. *A declared case is an accusation, not a conviction* — that sentence, and the coverage banner, travel with every view.
- **`/corruption` — Part III, Corruption Data.** Three deliberately separated lenses: NCRB Prevention-of-Corruption-Act enforcement by state (raw counts + NCRB's own published rates only), representative disclosures (reviewed PC-Act mapping, party comparison with minimum-sample suppression), and CAG audit findings (currently *pipeline in review*: real report metadata, zero extracted findings). **No composite corruption score exists, by design.**
- Trust pages: [`/methodology`](https://www.indiatechcollective.org/methodology/) · [`/sources`](https://www.indiatechcollective.org/sources/) · [`/coverage`](https://www.indiatechcollective.org/coverage/) · [`/corrections`](https://www.indiatechcollective.org/corrections/).

Data in this release: OGD 2024 results (GODL), the ADR/National Election Watch winners report (single cited download — no MyNeta scraping), NCRB Crime in India 2023 tables (GODL), CAG listing metadata. Every record carries sources, a status-as-of date and a review state; the build **fails** if an adverse claim lacks them. Details: [`docs/architecture.md`](docs/architecture.md), [`docs/data-sources.md`](docs/data-sources.md), [`docs/methodology.md`](docs/methodology.md), [`docs/editorial-policy.md`](docs/editorial-policy.md) (launch checklist includes a pending Indian legal review), [`docs/corrections-policy.md`](docs/corrections-policy.md), [`docs/runbook.md`](docs/runbook.md).

## Run it

```sh
npm install
npm run dev              # local dev at http://localhost:4321

npm run build            # data:check → og:generate → astro build → CSP verify
npm run preview          # serve the production build

# data pipeline (committed artifacts mean you rarely need this)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run data:all         # fetch → normalize → validate → build → check

npm test                 # Vitest (schemas, metrics, gates, statutes, CSV)
npm run test:e2e         # Playwright + axe accessibility checks
npm run build:demo       # clearly-labelled fixture build (dist-demo/)
```

Deploy: any static host; on Vercel the Astro preset is auto-detected (output `dist/`). See the [runbook](docs/runbook.md).

## Volunteer — open an issue

The fastest way to help is to [**open an issue telling us what you can do**](https://github.com/iamthevengence-orsomething/india-tech-collective/issues/new?title=I%20want%20to%20help%3A%20%5Bwhat%20I%20can%20do%5D). One line is enough. For example:

- **Translate** — app strings, safety guides, or this site into Hindi, Tamil, Bengali, Telugu, Marathi, Kannada, Malayalam, or any Indian language
- **Run a workshop** — teach digital safety at your college, newsroom, or community space
- **Code** — improvements to this page, or contributions to any tool listed below
- **Review** — copy edits, accessibility fixes, security/fact checks of what we list

## The toolkit

Every tool is open source and publicly available. Links go to official sources — the same software recommended by Reporters Without Borders, the EFF, and digital-rights groups worldwide.

### Offline / mesh communication (works during internet shutdowns)

| Tool | What it is |
|---|---|
| [Briar](https://briarproject.org) | P2P encrypted messenger over Bluetooth/Wi-Fi, no servers. Became a lifeline during Iran's January 2026 shutdown that cut off 85M+ people. |
| [Bitchat](https://bitchat.free) | Bluetooth mesh chat, no internet or SIM needed. Downloads in Nepal jumped ~1,400% in five days during the Sept 2025 Gen-Z protests. |
| [Meshtastic](https://meshtastic.org) | Open-source LoRa long-range mesh network for off-grid text messaging on cheap radios. |
| [Bridgefy](https://bridgefy.me) | Bluetooth mesh messaging used in Hong Kong, Myanmar, and elsewhere. ⚠️ Researchers found serious security flaws in earlier versions — prefer Briar for sensitive comms. |

### Secure messaging

| Tool | What it is |
|---|---|
| [Signal](https://signal.org) | The gold-standard open-source E2E-encrypted messenger. |
| [Element / Matrix](https://element.io) | Decentralized, self-hostable encrypted chat rooms. |
| [Delta Chat](https://delta.chat) | Encrypted messaging over ordinary email servers, hard to block. |

### Censorship circumvention

| Tool | What it is |
|---|---|
| [Tor Browser](https://www.torproject.org) | Anonymous browsing; access blocked sites. |
| [Snowflake](https://snowflake.torproject.org) | Run a browser extension to become a proxy helping censored users reach Tor. |
| [Psiphon](https://psiphon.ca) | Open-source VPN/proxy tunnel built to defeat filtering. |
| [Ceno Browser](https://censorship.no) | P2P web browser that shares cached pages across users. |

### Documenting & verifying evidence

| Tool | What it is |
|---|---|
| [Tella](https://tella-app.org) | Camera app that encrypts and hides photos/videos, built for human-rights documentation. |
| [ProofMode](https://proofmode.org) | Guardian Project tool adding cryptographic metadata to photos/videos so they're verifiable evidence. |
| [eyeWitness to Atrocities](https://www.eyewitness.global) | Court-ready verified footage capture. |

### Monitoring shutdowns & censorship

| Tool | What it is |
|---|---|
| [OONI Probe](https://ooni.org) | Run a test, contribute open data on what's blocked in your network. |
| [internetshutdowns.in](https://internetshutdowns.in) | India's live shutdown tracker, by SFLC.in. |
| [NetBlocks](https://netblocks.org) | Real-time global internet observatory. |

### Organizing & civic participation

| Tool | What it is |
|---|---|
| [Ushahidi](https://www.ushahidi.com) | Open-source crowdsourced mapping/reporting, born from crisis response. |
| [Loomio](https://www.loomio.org) | Collaborative decision-making for groups. |
| [Decidim](https://decidim.org) | Participatory-democracy platform used by cities worldwide. |
| [Consul Democracy](https://consuldemocracy.org) | Citizen-participation platform — proposals, budgets, votes. |
| [CiviCRM](https://civicrm.org) | CRM for nonprofits and volunteer movements. |
| [Spoke](https://github.com/StateVoicesNational/Spoke) | Open-source peer-to-peer texting for mobilization. |

### Whistleblowing & journalism

| Tool | What it is |
|---|---|
| [SecureDrop](https://securedrop.org) | Anonymous submission system used by major newsrooms. |
| [OnionShare](https://onionshare.org) | Share files anonymously over Tor. |
| [GlobaLeaks](https://www.globaleaks.org) | Self-hostable whistleblowing platform. |
| [Tails](https://tails.net) | Amnesic live OS that leaves no trace on the computer. |

## Learn digital safety

- [Security-in-a-Box](https://securityinabox.org) — Front Line Defenders' practical guides
- [EFF Surveillance Self-Defense](https://ssd.eff.org) — threat-modeling and tool guides
- [Umbrella](https://secfirst.org) — Android app with digital & physical safety lessons, including attending protests safely

## India's digital-rights ecosystem

- [Internet Freedom Foundation](https://internetfreedom.in) — litigation, policy, and civic literacy; grew out of the SaveTheInternet net-neutrality campaign
- [SFLC.in](https://sflc.in) — legal services for digital freedoms
- [DataMeet](https://datameet.org) — India's open-data community
- [Access Now #KeepItOn](https://www.accessnow.org/campaign/keepiton) — global coalition against internet shutdowns

## What's in the page

- Canvas mesh-network hero animation (vanilla JS, respects `prefers-reduced-motion`)
- Filterable toolkit grid (vanilla JS, no dependencies)
- Per-tool 1080×1080 share-card PNG generator (offscreen canvas)
- Pre-filled WhatsApp / X / Telegram share row

## Disclaimer

The India Tech Collective is a non-partisan educational resource. We advocate lawful, peaceful civic participation and list only open-source, publicly available software. Verify every app's security independently — links go to official sources.

## License

[MIT](LICENSE)
