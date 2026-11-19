# Existing code audit and changes

Original upload: HealthBridge-Fullstack-Source (1)(1).zip.

The existing stack is HTML/CSS/vanilla JavaScript for the actual portal, a TypeScript service exposed through a Vinext/Next route, Cloudflare D1/R2, and Drizzle migrations. The landing page is not a React component: app/page.tsx redirects to public/portal.html.

Working foundations retained: server memberships; patient and assigned-doctor authorization; optimistic versions; SQL appointment and bed uniqueness; protected uploads; billing, clinical documents, hospital profile; server-side report assistant; fictional seed data; original regression tests.

Main gaps: local setup depended on a cloud-style framework/sign-in simulator; no distinct password demo accounts; no ABHA/consent entities, care-task engine or structured FHIR observations; timeline lacked historical admission/discharge changes; no expiring exchange permissions; no test-to-review-to-follow-up loop.

Changes:
- Added local/runtime.mjs and local/server.mjs as adapters around the same service. No rewrite of original frontend or replacement of hosted D1/R2 code.
- Added server-side continuity routes, additive migration 0001, and state projections for new entity types.
- Added public/continuity.js and continuity.css; portal.html only adds those asset references.
- Added three isolated demo identities and server-side sessions, with no sensitive healthcare data in browser storage.
- Prevented reassignment of an existing clinical object's patient association through generic PATCH.
- Preserved original build/hosted scripts under dev:hosted; changed dev to the simpler Node launcher.
- Added documentation and dependency-free tests.

No changes to the original landing renderer, original style.css, enhancements.js, or hospital hero image. The new CSS primarily targets the authenticated portal panels.

Data migration: existing entities table is extended by new entity kinds, not dropped or recreated. Migration 0001 adds indexes. Local SQLite migration execution is tracked in a migrations table and wrapped in a transaction. Cloud local-setup already enumerates SQL files and tracks applied migrations. Local and Cloudflare data stores are separate; the adapter does not silently copy production data.
