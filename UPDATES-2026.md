# HealthBridge — November 2026 improvement package

## Run in VS Code (Windows)

1. Extract this ZIP and open the `HealthBridge-MRI-Upgrade` folder in VS Code.
2. Install Node.js **24 or newer**. (Node 22.16 can work experimentally with `node --experimental-transform-types local/server.mjs`, but Node 24 is recommended.)
3. Open VS Code Terminal and run `npm run dev` (this is a dependency-free local server for the demo). Navigate to `http://localhost:5173`.
4. Select **Patient**, **Doctor**, or **Staff / Admin**, then register with a test email and password of at least 12 characters. Existing sample accounts can be selected under *Explore care portals*; password: `HealthBridge@123`.
5. Local SQLite data lives in `local-data/` and is created at first run; it is not packaged. All users registering as doctor or admin are granted that role **for local testing only**. Do not publicly expose this demo as a real hospital service. Production requires credential verification, staff invitations, and access-control review.

## What changed

- Fixed blocked vertical scrolling, scrollable sidebar, overflow in dialogs, nested tables, calendars and chat. Mobile sidebar navigates horizontally.
- Role selection in sign-in and registration. Local API registration supports patient, doctor, and admin test roles, persisted in SQLite; login verifies the selected role.
- Language selector on login and portal, broad Hindi/Marathi translation dictionary for navigation and common UI labels. Clinical content, free-form text, and certain technical phrases are intentionally unchanged. This is **not** a complete professional translation of every UI string.
- Care assistant attachment UI accepts PDFs, JPEG/PNG, and TXT for prescriptions, reports, invoices, and general questions (5 MB). The underlying API stores them as uploads in patient records, and can send selected documents to the OpenAI Responses API only with explicit consent and a server-side API key.
- Alzheimer's-only MRI upload category and restricted model selection to `efficientnet_b0` and `densenet121`. Results show the checkpoint's predicted label and per-label scores, with a clarification that classification is **not** a clinical severity diagnosis.

## Enable AI report explanations

In PowerShell before running `npm run dev`:

```powershell
$env:OPENAI_API_KEY='YOUR_OWN_API_KEY'
$env:OPENAI_MODEL='gpt-4.1'
npm run dev
```

**Never add the secret to browser JS or commit it.** Without a key, the care assistant uses a basic reference-range guide; PDF/scan content analysis is unavailable.

## Enable MRI inference

The ZIP does **not** contain trained model weights. See `inference/README.md` and configure validated ONNX checkpoints for EfficientNet-B0 and DenseNet121, plus accurate preprocessing and label mappings. Start the Python inference service; set `MRI_API_URL=http://127.0.0.1:8001` in the Node server environment. Inference is disabled when models are unavailable. It does not generate fake severity scores.

The workflow accepts only 2D de-identified PNG/JPEG slices and does not independently determine that a file is a valid brain MRI. This project is an academic prototype, not a diagnostic or ABDM-certified medical system. ABHA linking is not live ABDM verification.

## Preview

The full interactive site runs at `http://localhost:5173` after executing `npm run dev`. See `HealthBridge-site-preview.png` (provided beside the ZIP) for a static homepage screenshot. A live public hosting URL has not been deployed.
