# Official integration boundary

`server/abdm-adapter.ts` defines the future server-only adapter contract. Its default implementation rejects every official operation. The running demo does not call an ABDM endpoint or accept real ABHA numbers.

Implement official integration only after obtaining sandbox onboarding and approved credentials. Pin the applicable current API and FHIR profile versions; implement documented identity verification, server token storage, consent request/artefact validation, expiry/revocation, authenticated callbacks and encrypted health-information exchange. Validate real responses before marking identity as verified. Do not enable a badge based only on a user-entered identifier or an HTTP request succeeding.

Official reference entry points consulted for this work:
- ABDM sandbox: https://sandbox.abdm.gov.in/
- NRCeS published ABDM FHIR implementation guide: https://www.nrces.in/ndhm/fhir/r4/index.html
- NRCeS adoption guide: https://www.nrces.in/download/files/pdf/Implementation_Guide_for_Adoption_of_FHIR_in_ABDM_and_NHCX.pdf

The imported demo Observation subset is intentionally smaller than the published ABDM profiles. The application does not assert ABDM certification, DPDP compliance, or full FHIR conformance.
