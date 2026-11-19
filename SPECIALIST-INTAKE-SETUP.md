# HealthBridge — patient intake & doctor specialization

## Run
Open the inner HealthBridge-Updated folder in VS Code.
Terminal 1: `python inference\server.py`
Terminal 2: `$env:MRI_API_URL="http://127.0.0.1:8001"` followed by `npm install` and `npm run dev`.
Open http://localhost:5173.

## Features
- Patient self-registration remains in the login/create account flow, with an automatically assigned patient ID.
- Staff/Admin portal > Patients > Add new patient creates a record and can check the patient in immediately. The server records arrival time.
- Staff can manage doctor specialties (labels are staff-entered, not inferred credentials).
- Appointments require a selected active doctor and store date, time, reason and doctor ID.
- Care Log arrival and clinical updates can include treating doctor, department and treatment note. The backend records update time.
- All existing care stages, MRI checkpoints and UPI functionality are kept.

## Notes
Only staff may administratively manage specialty labels. The doctor list must include real doctor portal accounts. No clinical AI automatically decides which specialist is appropriate. Existing accounts and local data can be reused.
