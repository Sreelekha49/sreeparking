// Sreelekha Parking Management System - Dashboard Controller

async function loadDashboard() {
  try {
    const data = await api('/dashboard');

    const totalSlots = data.slots.total || 0;
    const availSlots = data.slots.available || 0;
    const occSlots = data.slots.occupied || 0;
    const maintSlots = data.slots.maintenance || 0;

    // Metric KPI numbers
    document.getElementById('totalSlots').textContent = totalSlots;
    document.getElementById('availableSlots').textContent = availSlots;
    document.getElementById('occupiedSlots').textContent = occSlots;
    document.getElementById('revenue').textContent = money(data.records.revenue);
    document.getElementById('completedCount').textContent = `${data.records.completed || 0} completed`;

    const occPct = totalSlots > 0 ? Math.round((occSlots / totalSlots) * 100) : 0;
    document.getElementById('occupancyRate').textContent = `${occPct}% capacity in use`;
    document.getElementById('occupancyBadge').textContent = `${occPct}% Occupied`;

    // Progress Bar
    const availPct = totalSlots > 0 ? (availSlots / totalSlots) * 100 : 0;
    const occupiedPct = totalSlots > 0 ? (occSlots / totalSlots) * 100 : 0;
    const maintPct = totalSlots > 0 ? (maintSlots / totalSlots) * 100 : 0;

    document.getElementById('barAvailable').style.width = `${availPct}%`;
    document.getElementById('barOccupied').style.width = `${occupiedPct}%`;
    document.getElementById('barMaintenance').style.width = `${maintPct}%`;

    document.getElementById('progressAvailLabel').textContent = `Available: ${availSlots} (${Math.round(availPct)}%)`;
    document.getElementById('progressOccLabel').textContent = `Occupied: ${occSlots} (${Math.round(occupiedPct)}%)`;
    document.getElementById('progressMaintLabel').textContent = `Maintenance: ${maintSlots}`;

    // Render Recent Table
    const tbody = document.getElementById('recentRows');
    if (!data.recent || data.recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748b;">No recent parking records recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.recent.map(r => `
      <tr>
        <td><b>#${r.record_id}</b></td>
        <td>
          <b>${esc(r.vehicle_number)}</b>
          <div style="font-size:11px; color:#64748b;">${esc(r.vehicle_type)} &bull; ${esc(r.vehicle_model)}</div>
        </td>
        <td>${esc(r.owner_name)}</td>
        <td>
          <span style="font-weight:700; color:#2563eb;">${esc(r.slot_number)}</span>
          <div style="font-size:11px; color:#64748b;">${esc(r.location)}</div>
        </td>
        <td>${dt(r.entry_time)}</td>
        <td>${dt(r.exit_time)}</td>
        <td><b>${money(r.parking_fee)}</b></td>
        <td><span class="status ${r.status}">${r.status}</span></td>
        <td>
          ${r.status === 'Active' 
            ? `<button class="btn primary sm" onclick="checkoutVehicle(${r.record_id})">Check out</button>`
            : `<button class="btn outline sm" onclick="viewReceipt(${r.record_id})">Receipt</button>`
          }
        </td>
      </tr>
    `).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function checkoutVehicle(recordId) {
  if (!confirm(`Are you sure you want to check out Record #${recordId} and calculate fees?`)) {
    return;
  }

  try {
    const res = await api(`/parking/exit/${recordId}`, { method: 'POST' });
    showToast(`Checked out! Total fee: ${money(res.fee)}`, 'success');
    loadDashboard();
    renderReceiptModal(res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewReceipt(recordId) {
  try {
    const res = await api(`/records/${recordId}`);
    renderReceiptModal(res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderReceiptModal(data) {
  const modal = document.getElementById('receiptModal');
  const body = document.getElementById('receiptBody');

  const fee = data.fee !== undefined ? data.fee : (data.parking_fee || data.total_fee || '0.00');
  const hours = data.billableHours || data.billed_hours || 1;
  const rate = data.hourlyRate || data.hourly_rate || (data.vehicle_type === 'Car' ? 30 : 15);

  body.innerHTML = `
    <div class="receipt-ticket">
      <div class="receipt-header">
        <h3>SREELEKHA PARKING</h3>
        <p>TAX INVOICE & RECEIPT</p>
        <p style="margin-top:4px;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
      </div>

      <div class="receipt-row bold">
        <span>Receipt No:</span>
        <span>#REC-${data.recordId || data.record_id}</span>
      </div>
      <div class="receipt-row">
        <span>Customer:</span>
        <span>${esc(data.ownerName || data.owner_name || 'Customer')}</span>
      </div>
      <div class="receipt-row">
        <span>Vehicle Plate:</span>
        <span><b>${esc(data.vehicleNumber || data.vehicle_number)}</b> (${esc(data.vehicleType || data.vehicle_type)})</span>
      </div>
      <div class="receipt-row">
        <span>Assigned Slot:</span>
        <span>${esc(data.slotNumber || data.slot_number)} (${esc(data.location)})</span>
      </div>
      <div class="receipt-row">
        <span>Entry Time:</span>
        <span>${dt(data.entryTime || data.entry_time)}</span>
      </div>
      <div class="receipt-row">
        <span>Exit Time:</span>
        <span>${dt(data.exitTime || data.exit_time || new Date())}</span>
      </div>
      <div class="receipt-row">
        <span>Billed Duration:</span>
        <span>${hours} hour(s)</span>
      </div>
      <div class="receipt-row">
        <span>Tariff Rate:</span>
        <span>₹${rate}/hr</span>
      </div>

      <div class="receipt-row total">
        <span>TOTAL PAID:</span>
        <span>${money(fee)}</span>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('active');
}

// Initial load
document.addEventListener('DOMContentLoaded', loadDashboard);
