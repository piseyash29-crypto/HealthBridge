# Verification — 16 November 2026

Runtime: Node.js 24.22.1, built-in SQLite, no project dependency installation.

## Passed

- `node tests/continuity.mjs`: **57 API and persistence checks**, including unauthenticated requests, role escalation rejection, doctor approval, assigned-patient access, profile stale writes, appointment confirmation, appointment conflict/completion rules, demo identity safeguards, consent revocation, FHIR patient mismatch and duplicate rejection, lab review and automatic follow-up, notifications, source summaries, protected uploads, same-origin enforcement and database reopen persistence.
- `node tests/backend-local.mjs`: original backend regression scenario passed against the same service through local SQLite/storage adapters. Tests original registration, authorization, slot conflicts, stale updates, consultation timeline, uploads, sharing, file rejection/deletion, chat history and measurement validation.
- `node tests/http.mjs`: HTTP landing availability, rejection of spoofed identity headers, cross-origin login rejection, wrong/correct password, session cookie flags, patient isolation, logout and session invalidation.
- JavaScript syntax checks passed for continuity.js, local/server.mjs and local/runtime.mjs.
- Byte comparison against the supplied ZIP confirmed public/app.js, public/enhancements.js, public/style.css and public/assets/hospital.png are unchanged.

## Browser workflow observed

The original hospital landing page rendered. Patient sign-in, demo identity linking and permission grant succeeded. Doctor sign-in showed only the assigned patient. Creating a lab task, importing its synthetic FHIR report, reviewing it and completing it produced a completed task and a new pending follow-up in the actual UI.

Internal preview used port 4173; the downloadable application defaults to 5173. Test/demo database contents and login sessions are excluded from the delivered source ZIP.

## Limits

- No production hosting deployment was performed. Original Cloudflare framework dependencies, static typecheck, Worker build and Miniflare test target were not rerun; local runtime and adapter tests are the verified path.
- No real ABDM integration, live external AI-provider call, full FHIR validator, no-show model training, mobile-device browser test, security certification or load test was performed.
- The source-linked summary is deterministic extraction. No measured ML scores are claimed.
- Original regression coverage is not evidence that all UI interactions were visually tested. See FEATURE-STATUS.md for incomplete scope.

Actual terminal output is included in test-output.txt.
