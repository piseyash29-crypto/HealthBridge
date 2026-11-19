/* Patient-only UPI QR payment request (no automatic payment confirmation). */
const originalBillingWithRecords = billing;
billing = function(){
  if(!session || actualRole!=='patient' || session.role!=='patient')return originalBillingWithRecords();
  const invoices=myBills();
  return `<section class="panel"><div class="panel-title"><h3>Your invoices & payments</h3><span class="note">Secure UPI scan & pay</span></div><div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Service</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead><tbody>${invoices.map(b=>`<tr><td>${esc(b.id)}</td><td>${esc(b.title)}</td><td>₹${Number(b.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>${badge(b.status)}</td><td>${b.status==='Unpaid'?`<button class="small" onclick="openPaymentQR('${encodeURIComponent(b.id)}')">Scan & Pay</button>`:'Paid'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No invoices yet.</td></tr>'}</tbody></table></div><p class="note">QR opens a UPI payment request. Your bank processes the transfer. A bill stays unpaid until the hospital verifies it.</p></section>`;
};
async function openPaymentQR(encodedId){
  if(actualRole!=='patient'||session.role!=='patient')return toast('Only the patient portal can open payments.');
  const invoice=decodeURIComponent(encodedId);
  try{
    const response=await fetch('/api/local/payments/details?invoice='+encodeURIComponent(invoice),{credentials:'same-origin'});
    const detail=await response.json();if(!response.ok)throw Error(detail.error||'Payment details unavailable');
    const img='/api/local/payments/qr?invoice='+encodeURIComponent(invoice);
    modal('Scan & Pay — '+esc(invoice),`<div class="upi-sheet"><div><span class="note">Paying</span><h3>${esc(detail.recipient)}</h3><p class="note">UPI: ${esc(detail.upiId)}</p><h2>₹${esc(detail.amount)}</h2></div><img class="upi-code" src="${img}" alt="UPI payment QR for invoice ${esc(invoice)}" onerror="this.hidden=true;document.getElementById('upi-qr-warning').hidden=false"><p id="upi-qr-warning" class="note" hidden>QR unavailable. Install Python qrcode with: python -m pip install qrcode</p><a class="button secondary" href="${esc(detail.link)}">Open UPI app ↗</a><p class="note">Check the recipient name and exact amount in your UPI app before approving. Scanning alone does not pay your invoice.</p><form onsubmit="submitPaymentReference(event,'${encodeURIComponent(invoice)}')"><label class="field">UPI transaction reference / UTR<input name="reference" minlength="6" maxlength="35" pattern="[A-Za-z0-9-]{6,35}" autocomplete="off" placeholder="Enter reference after paying" required value="${esc(detail.reference)}"></label><p id="form-error" class="error"></p><button class="full">Submit reference for verification</button></form><p class="note">Current status: <b>${esc(detail.status)}</b>. This form does not confirm a successful payment.</p></div>`);
  }catch(error){operationError(error)}
}
async function submitPaymentReference(event,encodedId){
  event.preventDefault();const id=decodeURIComponent(encodedId);
  const button=event.target.querySelector('button');button.disabled=true;
  try{
    const res=await fetch('/api/local/payments/reference?invoice='+encodeURIComponent(id),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:new FormData(event.target).get('reference')})});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Could not submit reference');
    closeModal();toast(data.message);await sync();
  }catch(error){operationError(error);button.disabled=false}
}
