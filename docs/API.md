# HealthBridge API

Base: `/api/hb/`. Original routes in `server/service.ts` remain. JSON responses disable caching. Non-GET operations require same-origin Origin. Runtime sessions resolve a server-side member; browser-supplied identity headers are discarded by the local server.

## Local account API

- `POST /api/local/login`: `{email,password}`. Demo accounts only. Random HttpOnly/SameSite=Strict cookie, eight-hour expiry, rate limit of 20 attempts per minute per loopback client.
- `POST /api/local/logout`: invalidates current session.
- `GET /api/local/config`: local runtime detection; no private data.

## Existing endpoints

- `GET session`, `POST register`, `GET state`, `POST seed`.
- `POST entities/:kind`, `PATCH entities/:kind/:id`: kinds patients, appointments, records, prescriptions, bills, beds, hospital. PATCH requires `_version`.
- `POST upload`: multipart patient, file, title, date. Max file 5 MB; PDF/PNG/JPEG/text. `GET|PATCH|DELETE reports/:id` controls download/sharing/removal.
- `GET|POST chat`: protected report assistant/history, external provider optional.
- `PATCH members/:id`: admin approval/disable.

## Continuity endpoints

Every request needs an authorized patient: JSON `patient` on mutations; query `?patient=P-001` on GET. Patients can access themselves; doctors need assignment; admins have operational access.

| Method / suffix under `continuity/` | Payload | Authorization / result |
|---|---|---|
| PATCH profile | `_version,phone,address,emergency` | Patient only; editable contact fields only |
| POST confirm | `id,_version` | Doctor/admin; confirms a scheduled appointment |
| POST abha | `mode:"demo",consent:true` | Patient only; synthetic link; official mode returns 503 |
| DELETE abha | none | Patient only; unlink and revoke active demo exchange grants |
| POST consent | `days:1\|7\|30,agreed:true` | Patient only; requires linked demo identity; replaces old active grant |
| DELETE consent | `id` | Patient only; revokes the named grant |
| POST tasks | `title,type,due,encounter?` | Doctor/admin; type Lab test or Follow-up; owner is creator |
| PATCH tasks | `id,_version,status,note?` | Allowed transitions enforced; patient may start a pending task; clinical completion requires note |
| POST import | `bundle,taskId?` | Doctor/admin plus active patient exchange consent |
| GET export | query patient | Authorized account plus active exchange consent; FHIR collection Bundle |
| GET summary | query patient | Authorized source extraction with IDs and review label |
| PATCH notifications | `id` | Marks read for current member only |

Task transitions: Pending → In Progress/Cancelled; In Progress → Awaiting Review/Cancelled; Awaiting Review → Completed/In Progress/Cancelled. FHIR import can move an open Lab test directly to Awaiting Review. A linked observation is required before submitting a lab test for review. Completion creates a review record and, for a lab test, a seven-day follow-up task.

## FHIR import subset

Bundle.resourceType=`Bundle`, type=`collection`, 1–50 entries. Each entry must contain an Observation with:
- FHIR-style id (1–64 alphanumeric/dot/hyphen characters).
- final/amended/corrected status.
- `subject.reference` exactly equal to `Patient/<selected patient ID>`.
- `identifier[0].system` and `.value` identifying the source record.
- `code.text`, valid `effectiveDateTime`, numeric `valueQuantity.value` and unit.
- If referenceRange is provided, ordered numeric low/high with units matching the quantity.

The bundle is validated before insertion; a duplicate source identifier or incorrect patient reference rejects the import. Source resource JSON and identifiers are retained. This is not the official FHIR validator.

## Errors

400 invalid payload/transition; 401 unauthenticated; 403 role, patient, Origin or consent denial; 404 missing record; 409 duplicate/stale/conflicting record; 413 body too large; 429 rate limit; 503 unconfigured official integration. No third-party exchange takes place in demo mode.
