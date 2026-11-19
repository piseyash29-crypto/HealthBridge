# Implementation status

## Implemented and tested locally

| Area | Delivered behavior |
|---|---|
| Original design | Original app.js, enhancements.js, style.css and hospital image preserved; additive portal script/CSS |
| Local run | Dependency-free Node 24 server and SQLite/R2-compatible local adapters using the existing TypeScript service |
| Accounts | Patient, assigned doctor and administrator; hashed demo passwords, random expiring HttpOnly sessions, sign-out invalidation |
| Original workflows | Patient CRUD, doctor approval/assignment, booking/rescheduling/cancellation/completion, clinical records, prescriptions, bills and beds retained |
| Appointments | Added clinician confirmation and patient inbox notification |
| Profile | Patient contact, address and emergency-contact updates with stale-write rejection |
| Identity | Fictional demo link/unlink; no real identifier collected; verified=false; official mode fails closed |
| Permissions | Patient-only grant/replace/revoke, 1/7/30-day expiry, history and server enforcement on FHIR exchange |
| Care pathways | Assigned owner, optional appointment link, due dates, overdue state, transition validation and history |
| Care loop | Lab order → result import → awaiting review → review note → automatic follow-up task |
| Structured records | FHIR collection Bundle Observation subset import; Patient/Observation/Task export; provenance, patient matching, duplicate rejection |
| Twin | Existing medical timeline extended with identity/consent/import/task/admission/discharge events |
| Measurements | Historical comparisons only for the same measurement label, units and supplied reference-range limits |
| Summaries | Deterministic source-linked extraction; no inference; clinician-review label |
| Notifications | Persistent in-app care events and per-account read state |
| Files | Original protected report upload/download/share/unshare/delete retained |
| Administration | Original patient/doctor controls, hospital settings, billing and bed/ICU UI retained; added care oversight |
| Tests | Original backend regression scenario adapted to local SQLite, new continuity suite and HTTP session suite |

## Simulated or deliberately bounded

- ABHA identity and exchange are synthetic. There is no verified ABHA badge, OTP process or network exchange with ABDM.
- FHIR validation is handwritten validation of the documented import subset, not full FHIR schema or ABDM profile conformance validation.
- The Digital Health Twin is an evolving patient record, not a validated physiological/predictive simulation.
- Notifications are in-app; overdue indicators are computed when viewing tasks. No background scheduler, SMS or email delivery is installed.
- Admin role includes operational staff duties; separate reception, laboratory staff and clinical staff permission tiers are not implemented.
- Sample data is generated on first launch. Booking an appointment does not automatically grant a new doctor access; the administrator assigns the patient explicitly.
- Existing AI report assistant code is preserved. Without a server API key it uses its clearly labelled reference-range guide. Live provider behavior was not exercised.
- Offline local persistence is on the server disk, not a PWA/offline browser sync implementation.

## Incomplete / future integrations

- Real ABDM sandbox onboarding, approved credentials, identity verification, consent artefacts, encrypted HIP/HIU exchange, callback validation and integration certification. The adapter file is an interface and fail-closed stub only.
- Full FHIR resources: Practitioner, Appointment, Encounter, DiagnosticReport, MedicationRequest and CarePlan mapping, profiles and validator integration. Appointment identifiers can link local tasks; this is not a full Encounter model.
- Public no-show dataset acquisition, preprocessing and leakage-safe model training/comparison (Logistic Regression, Decision Tree, Random Forest). No dataset, trained model or measured scores are included.
- AI-generated clinical summaries and formal clinician sign-off workflow. Current summary is source extraction only; the saved care review note is a separate clinical record.
- Hospital directory/search across multiple facilities, specialist/slot scheduling rules, real video consultation and payment integration.
- Production identity/password management, account recovery, database/file encryption at rest, external secrets manager, backup/recovery operations, full regulatory/security review and high-load concurrency testing.
- Cloud framework dependency installation/typecheck/build and Worker deployment were not rerun for this upgrade. The validated delivery path is `node local/server.mjs`.

The scope above is intentionally explicit: the prototype does not claim that the full master development brief is complete.
