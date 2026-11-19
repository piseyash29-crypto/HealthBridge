# HealthBridge — Login repair & example data

## Start on Windows
1. Extract ZIP. Open **HealthBridge-Updated** (the inner folder with `package.json`) in VS Code.
2. Run `npm install` then `npm run dev` in that folder.
3. Visit `http://localhost:5173` — do not double-click `portal.html` or use a generic Live Server extension.

## JSON login error
Login now catches non-JSON API responses and gives an actionable error message. The local server sends JSON errors on API failures and prints details to the VS Code terminal. If the browser still shows old code, press Ctrl+Shift+R.

## Accounts
Use the portal selector. Existing local patient, doctor, and administrator accounts use `patient@healthbridge.demo`, `doctor@healthbridge.demo`, `admin@healthbridge.demo` respectively, with password `HealthBridge@123`. New account sign-up is available in all three roles for local development, not production access.

## Example data
A newly created local database starts with multiple formatted laboratory panels, prescription-style follow-up records and invoices across example patients. Existing databases are intentionally **not overwritten** to protect any data you entered. To see the new starter records, stop the server and rename the `local-data` directory to `local-data-backup` before restarting. Do not delete records without backing them up.

The MRI screen contains category reference cases (Non Demented / Very Mild / Mild / Moderate), clearly marked **Sample**. They do not claim actual image classification. For real inference, configure trained EfficientNet-B0 and DenseNet121 checkpoints and verify the preprocessing and validation.

**Note:** The seeded documents are examples for UI exploration. They are not signed prescriptions, diagnostic reports, or clinical evidence. Never use them to guide treatment.
