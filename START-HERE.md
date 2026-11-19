# HealthBridge — Connected Care & MRI Workspace

The original landing page design is preserved. This update adds normal email/password login, patient registration, a saved ABHA identifier as an alternate HealthBridge login, protected MRI image uploads, scan history, care-team review, result export, a care planner, and an ONNX model-service connector. Existing appointments, clinical records, prescriptions, billing, beds, consent, FHIR exchange and chatbot remain available.

## Run locally (Windows, macOS, Linux)

Install **Node.js 24 or newer**, extract the ZIP, then run:

```
node local/server.mjs
```

Open **http://localhost:5173**. On Windows you can double-click `START-WINDOWS.bat`. No npm installation is needed for this local app. SQLite and uploaded files persist in `local-data/`; do not commit or distribute that directory.

Sign in with email/password, or open **Explore care portals** to populate an account:

| Portal | Email | Password |
|---|---|---|
| Patient | patient@healthbridge.demo | HealthBridge@123 |
| Doctor | doctor@healthbridge.demo | HealthBridge@123 |
| Administrator | admin@healthbridge.demo | HealthBridge@123 |

These are synthetic presentation accounts. The hosted preview is private and additionally gated by the owner's platform sign-in. Do not make the preview public with these shared accounts or load real patient data. New registrations create patient accounts only; administrators manage care-team assignments. Existing local accounts and records are preserved on restart.

## ABHA and email login

The login interface is a normal email/password form with an alternate Health ID tab. Patients can save an ABHA number or address in ABHA & consent; the same identifier plus their HealthBridge password can then select their account. Unlinking removes that login alias and revokes active exchange consent.

**This is application-level linking, not official ABHA authentication, OTP verification or successful ABDM integration.** The UI does not use large mock/demo banners; it accurately states verification is pending. No Aadhaar or OTP is requested. Implement the approved ABDM adapter before claiming official verification.

## MRI uploads and predictions

1. Sign in and open **MRI workspace**.
2. Upload a de-identified PNG/JPEG MRI slice, maximum 5 MB. Give it a title and date.
3. Share with the care team when appropriate. Private scans are hidden from the doctor until shared.
4. If a trained model is connected, select it, consent to sending the image, and run analysis.
5. View class scores, model/version, and review status. A doctor or administrator can record a review, which is added to the patient timeline.
6. Export a result as JSON, or delete the source report from Reports to remove its associated scan record.

**No trained model weights were provided for this update.** Prediction stays unavailable until a model is configured. No random scores, invented diagnoses, or generic ImageNet classifications are shown as medical results. Tests use clearly labelled API fixtures solely to verify the integration.

`inference/README.md` explains how to connect your Kaggle EfficientNet-B0 and DenseNet models. The local Python service accepts ONNX exports and a manifest with your exact class order and preprocessing. Additional diseases require their own trained model and validation. Volumetric DICOM/NIfTI processing, MRI-versus-non-MRI validation, clinical calibration and diagnostic validation are not implemented.

## Chatbot

The care assistant works without an API key for reference-range comparisons and clinician discussion prompts. It does not read uploaded files in this mode. For AI report explanations, set `OPENAI_API_KEY` server-side and optionally `OPENAI_MODEL` (existing default: `gpt-4.1`). The app requires per-request consent to send report/context to the external service. Never put the key in frontend JavaScript. No live AI provider call was tested in this delivery because no API key was supplied.

PowerShell example (set your key locally, do not paste it into chat):

```
$env:OPENAI_API_KEY='your-key'
node local/server.mjs
```

## Model service configuration

- `MRI_API_URL`: localhost Python service URL or an HTTPS inference service.
- `MRI_API_TOKEN`: shared server-side bearer token for the inference service.
- `MRI_MANIFEST`: optional manifest path for the Python service.
- `MRI_HOST`, `MRI_PORT`: inference bind settings, default 127.0.0.1:8001.

See `inference/models.example.json`. Example class order and preprocessing must be replaced/verified against your notebook before `preprocessing_confirmed` is enabled. Validate ONNX output against the original checkpoint on identical held-out samples.

## Validation

```
node tests/continuity.mjs
node tests/backend-local.mjs
node tests/http.mjs
node tests/imaging.mjs
node scripts/build-hosted.mjs
node tests/hosted.mjs
```

The 57 continuity checks and original backend/HTTP regression checks pass. There are 32 additional imaging/API checks, plus hosted-worker identity/login tests. Browser checks covered the preserved landing page, email login, patient dashboard, MRI workspace, upload form, ABHA settings and a chatbot response. These are software tests, not evidence of medical accuracy. Trained MRI weights, real ABDM integration and live AI responses were not evaluated.

## Hosted source

The hosted build bundles this same app and service into an ESM Worker. D1 and R2 provide database/file storage; trusted platform identity restricts the workspace owner, with email/password profiles inside that private workspace. Python model serving must be hosted separately over HTTPS. Build with `node scripts/build-hosted.mjs`. Publishing must retain the Site's private access configuration and provision the D1/R2 bindings and migrations.

Older documentation is retained under `docs/` for the original prototype. This README and `inference/README.md` describe the new functionality and take precedence for login and MRI setup.
