# HealthBridge — Dated care workflow

Patient arrival, ongoing hospital stays, ICU and discharged patients are grouped in Care log. The 4-day threshold is based on the recorded arrival time. Clinical staff can update the expected discharge date and time; the timestamp is an estimate only. Actual changes are recorded by the server. Bed cards show entry time and estimated availability from the linked care episode. Medical reports and prescriptions show exact timestamps where recorded; historical date-only records retain the date without manufacturing a clock time.

For existing databases a one-time care-journey-dates-v2 migration backfills example timestamps for bundled starter records only. It does not overwrite user-authored clinical records.

Run from the inner HealthBridge-Updated directory:

```powershell
npm install
npm run dev
```

For MRI, start `python inference\server.py` in a second terminal after installing inference requirements.

**Clinical safety:** All prepopulated patient information is demonstration data. Actual discharge must be verified by a clinician; the estimated bed-free time is not a promise.
