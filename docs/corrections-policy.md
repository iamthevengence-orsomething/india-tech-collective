# Corrections policy

## Principles

Corrections are **data changes with provenance**, never silent edits. The public log
(`data/curated/corrections-log.json`, rendered at `/corrections/`) is append-only:
date, page, field, old value, new value, reason, authoritative source. Corrections to
corrections get new entries. Every applied correction changes the dataset version.

## Intake

- Public channel: the GitHub issue template `correction-request.yml`
  (linked from every profile and `/corrections/`). No email address is published
  because none exists for the project; if a private channel is established later,
  add it here and on the page — do not invent one.
- Requests must cite an authoritative source (court order, ECI record, gazette,
  official press note). Unverifiable requests are declined with reasons, publicly.
- Warn requesters not to post private personal data; redact/hide such content
  immediately if posted (GitHub content moderation), and note the redaction.

## Handling SLA and review

1. Acknowledge within a reasonable time; label `correction`.
2. Verify the source. For **materially adverse** changes (anything that worsens how a
   named person appears), a human maintainer must verify before publication — the
   pipeline's review gates make unreviewed adverse data unbuildable.
3. Apply in `data/curated/` (or upstream re-extraction), run `npm run data:all`,
   append the log entry, rebuild, deploy.
4. Close the issue linking the live log entry.

## Takedown / escalation

- If the subject of a record disputes it with a court order (quashing, acquittal,
  correction of record), update the record to the new procedural state with the order
  as source — records are corrected to truth, not deleted, because they reflect
  public sworn disclosures.
- If a record was **our error** (wrong person, parse error), fix immediately, log,
  and if the error was adverse, note the apology in the log entry.
- Legal notices: preserve the notice, pause promotion of the affected page, seek
  qualified counsel before responding (see launch checklist: lawyer review pending),
  and document the outcome in the log.
- Escalation path for maintainers: any maintainer can hot-disable a single profile
  by removing its record from curated overrides and rebuilding; a full site takedown
  is a repository-owner decision.
