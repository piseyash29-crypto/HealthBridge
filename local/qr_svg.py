"""Create an SVG QR code from a UPI URI using the qrcode package."""
import html
import sys
import qrcode

uri = sys.stdin.read(2048)
if not uri.startswith('upi://pay?') or len(uri) > 1500:
    raise SystemExit('Invalid UPI payment link')
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=6, border=4)
qr.add_data(uri)
qr.make(fit=True)
matrix = qr.get_matrix()
size = len(matrix)
# SVG with no remote assets; individual solid modules generate a portable QR.
print(f'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 {size} {size}" role="img" aria-label="Scan UPI payment QR"><rect width="{size}" height="{size}" fill="white"/>')
for y, row in enumerate(matrix):
    for x, on in enumerate(row):
        if on:
            print(f'<rect x="{x}" y="{y}" width="1" height="1" fill="#111827"/>')
print('</svg>')
