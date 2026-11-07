// Sreelekha Parking Management System - Slots & Records Controller

let allSlots = [];
let slotStatusFilter = 'All';
let slotTypeFilter = 'All';

let allRecords = [];
let recordStatusFilter = 'All';

// ==========================================
// PARKING SLOTS MANAGEMENT
// ==========================================

async function loadSlots() {
  const grid = document.getElementById('slotGrid');
  if (!grid) return;

  try {
    allSlots = await api('/slots');
    renderSlots();
  } catch (err) {
    grid.innerHTML = `<p style="color:#ef4444; padding:20px;">Failed to load slots: ${esc(err.message)}</p>`;
  }
}

function filterSlotStatus(status, btn) {
  slotStatusFilter = status;
  document.querySelectorAll('#slotFilters .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSlots();
}

function filterSlotType(type) {
  slotTypeFilter = type;
  renderSlots();
}

function renderSlots() {
  const grid = document.getElementById('slotGrid');
  if (!grid) return;

  let filtered = allSlots.filter(s => {
    if (slotStatusFilter !== 'All' && s.status !== slotStatusFilter) return false;
    if (slotTypeFilter !== 'All' && s.vehicle_type !== slotTypeFilter && s.vehicle_type !== 'Any') return false;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = '<p class="muted" style="grid-column:1/-1; text-align:center; padding:32px;">No slots match the selected criteria.</p>';
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const icon = s.vehicle_type === 'Car' ? '🚗' : s.vehicle_type === 'Bike' ? '🏍️' : '🅿️';
    const isOccupied = s.status === 'Occupied';
    const isMaint = s.status === 'Maintenance';
    const isAvail = s.status === 'Available';

    return `
      <article class="slot-card">
        <div class="slot-top">
          <div class="slot-icon-box ${s.vehicle_type}">
            ${icon}
          </div>
          <span class="status ${s.status}">${s.status}</span>
        </div>

        <div class="slot-info">
          <h3>${esc(s.slot_number)}</h3>
          <p>${esc(s.location)} &bull; <b>${esc(s.vehicle_type)}</b></p>
        </div>

        ${isOccupied ? `
          <div class="slot-occupied-info">
            <b>🚘 Parked:</b> ${esc(s.occupied_vehicle_number || 'Vehicle')} (${esc(s.occupied_vehicle_model || '')})
            <div style="font-size:11px; margin-top:2px;">Parked at: ${dt(s.occupied_since)}</div>
          </div>
        ` : ''}

        <div class="slot-actions">
          ${isAvail ? `
            <button class="btn outline sm" onclick="setSlotStatus(${s.slot_id}, 'Maintenance')">🛠️ Maintenance</button>
            <a class="btn primary sm" href="vehicles.html" style="margin-left:auto;">Park Here →</a>
          ` : isMaint ? `
            <button class="btn primary sm" onclick="setSlotStatus(${s.slot_id}, 'Available')">🟢 Mark Available</button>
          ` : isOccupied ? `
            <button class="btn primary sm" onclick="checkoutVehicleFromSlot(${s.active_record_id})">Check Out</button>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

async function setSlotStatus(slotId, newStatus) {
  try {
    const res = await api(`/slots/${slotId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(res.message, 'success');
    loadSlots();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAddSlotModal() {
  const modal = document.getElementById('addSlotModal');
  if (modal) modal.classList.add('active');
}

function closeAddSlotModal() {
  const modal = document.getElementById('addSlotModal');
  if (modal) modal.classList.remove('active');
}

async function submitAddSlot(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const res = await api('/slots', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast(res.message, 'success');
    form.reset();
    closeAddSlotModal();
    loadSlots();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function checkoutVehicleFromSlot(recordId) {
  if (!recordId) return;
  if (!confirm(`Check out vehicle record #${recordId}?`)) return;
  try {
    const res = await api(`/parking/exit/${recordId}`, { method: 'POST' });
    showToast(`Checked out! Fee: ${money(res.fee)}`, 'success');
    loadSlots();
    renderReceiptModal(res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// PARKING RECORDS & CHECKOUT MANAGEMENT
// ==========================================

async function loadRecords() {
  const tbody = document.getElementById('recordRows');
  if (!tbody) return;

  try {
    allRecords = await api('/records');
    renderRecords();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#ef4444; padding:20px;">${esc(err.message)}</td></tr>`;
  }
}

function filterRecordStatus(status, btn) {
  recordStatusFilter = status;
  document.querySelectorAll('#recordStatusPills .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRecords();
}

function handleRecordSearch() {
  renderRecords();
}

function renderRecords() {
  const tbody = document.getElementById('recordRows');
  if (!tbody) return;

  const search = (document.getElementById('recordSearch')?.value || '').toLowerCase().trim();

  let filtered = allRecords.filter(r => {
    if (recordStatusFilter !== 'All' && r.status !== recordStatusFilter) return false;

    const matchSearch = !search ||
      String(r.record_id).includes(search) ||
      r.vehicle_number.toLowerCase().includes(search) ||
      r.owner_name.toLowerCase().includes(search) ||
      r.slot_number.toLowerCase().includes(search);

    return matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:28px; color:#64748b;">No parking records found matching criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const isCar = r.vehicle_type === 'Car';
    const rateText = `₹${r.hourly_rate}/hr`;
    const durationText = `${r.billed_hours} hr (${r.elapsed_minutes || 0}m)`;

    return `
      <tr>
        <td><b>#${r.record_id}</b></td>
        <td>
          <div style="font-weight:700; color:#0f172a;">${esc(r.vehicle_number)}</div>
          <div style="font-size:11px; color:#64748b;">${isCar ? '🚗' : '🏍️'} ${esc(r.vehicle_type)} &bull; ${esc(r.vehicle_model)}</div>
        </td>
        <td>
          <b>${esc(r.owner_name)}</b>
          <div style="font-size:11px; color:#64748b;">${esc(r.owner_phone)}</div>
        </td>
        <td>
          <span style="font-weight:700; color:#2563eb;">${esc(r.slot_number)}</span>
          <div style="font-size:11px; color:#64748b;">${esc(r.location)}</div>
        </td>
        <td>${dt(r.entry_time)}</td>
        <td>${dt(r.exit_time)}</td>
        <td>
          <b>${durationText}</b>
          <div style="font-size:11px; color:#64748b;">Rate: ${rateText}</div>
        </td>
        <td>
          <b style="font-size:14px; color:${r.status === 'Completed' ? '#10b981' : '#f59e0b'};">
            ${money(r.calculated_fee)}
          </b>
        </td>
        <td><span class="status ${r.status}">${r.status}</span></td>
        <td>
          ${r.status === 'Active' 
            ? `<button class="btn primary sm" onclick="checkoutRecord(${r.record_id})">Check out</button>`
            : `<button class="btn outline sm" onclick="viewRecordReceipt(${r.record_id})">Receipt</button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

async function checkoutRecord(recordId) {
  if (!confirm(`Confirm checkout and calculate final charges for Record #${recordId}?`)) return;

  try {
    const res = await api(`/parking/exit/${recordId}`, { method: 'POST' });
    showToast(`Checked out! Total fee: ${money(res.fee)}`, 'success');
    loadRecords();
    renderReceiptModal(res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewRecordReceipt(recordId) {
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
  if (!modal || !body) return;

  const fee = data.fee || data.parking_fee || data.total_fee || '0.00';
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
        <span>Customer Name:</span>
        <span>${esc(data.ownerName || data.owner_name || 'Customer')}</span>
      </div>
      <div class="receipt-row">
        <span>Contact Phone:</span>
        <span>${esc(data.ownerPhone || data.owner_phone || '—')}</span>
      </div>
      <div class="receipt-row">
        <span>Vehicle Plate:</span>
        <span><b>${esc(data.vehicleNumber || data.vehicle_number)}</b> (${esc(data.vehicleType || data.vehicle_type)})</span>
      </div>
      <div class="receipt-row">
        <span>Model:</span>
        <span>${esc(data.vehicleModel || data.vehicle_model || '—')}</span>
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
        <span>Duration Billed:</span>
        <span>${hours} hour(s)</span>
      </div>
      <div class="receipt-row">
        <span>Tariff Rate:</span>
        <span>₹${rate}/hr</span>
      </div>

      <div class="receipt-row total">
        <span>TOTAL AMOUNT:</span>
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

// Auto load based on which page is open
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('slotGrid')) loadSlots();
  if (document.getElementById('recordRows')) loadRecords();
});
