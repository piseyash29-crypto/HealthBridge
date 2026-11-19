# Patient-only UPI QR payments — local HealthBridge

This upgrade adds **Scan & Pay** only to the signed-in Patient portal's Billing screen. Doctor and Admin screens do not include payment QR controls. Requests are checked against the authenticated patient and invoice in SQLite.

## Configure payment receiving details

In a VS Code PowerShell terminal inside `HealthBridge-Updated`:

```powershell
$env:HB_UPI_ID="hospitalmerchant@yourbank"
$env:HB_UPI_NAME="Your Hospital Name"
python -m pip install qrcode
npm run dev
```

**Replace** the placeholder values with the hospital's actual authorized UPI ID and name. Do not use the example ID; no default payment recipient is hard-coded. Keep your MRI service running in the other terminal if needed.

## What happens

1. Sign in to the Patient portal, open **Billing** and select **Scan & Pay** on an unpaid invoice.
2. The server generates a UPI deep link and a scannable SVG QR for the configured receiving UPI ID and invoice amount.
3. The patient pays in their own UPI app, then may submit a UPI transaction reference (UTR).
4. HealthBridge stores the reference as **Verification pending** in a dedicated `payment_requests` SQLite table. The invoice remains **Unpaid** until independently verified.

No money is collected by HealthBridge itself; the bank/UPI app handles the transfer. The QR flow is **not integrated with a payment gateway, PSP callback, webhook, refund system, or bank reconciliation**. A submitted reference is not payment proof. For production, integrate a certified PSP with webhook verification, signed callbacks, idempotency, auditing, and merchant onboarding.

## Troubleshooting

- If you see `HB_UPI_ID is not configured`, set the environment variables **in the same terminal** before `npm run dev` and restart the server.
- If QR generation fails, run `python -m pip install qrcode` using the same Python used for the project. You can still use the **Open UPI app** link.
- If port 5173 is occupied, stop the older HealthBridge server with Ctrl+C before starting this project.
- The project is inside the **inner `HealthBridge-Updated` directory** of the ZIP.
