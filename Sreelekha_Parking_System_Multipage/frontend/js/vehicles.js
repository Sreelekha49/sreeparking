// Sreelekha Parking Management System - Vehicle Controller

let allVehicles = [];
let currentFilter = 'all';

async function updateAvailableSlotsDropdown() {
  const typeSelect = document.getElementById('vehicleTypeSelect');
  const slotSelect = document.getElementById('slotSelect');
  if (!typeSelect || !slotSelect) return;

  const type = typeSelect.value;
  try {
    const slots = await api(`/vehicles/available-slots?type=${encodeURIComponent(type)}`);
    slotSelect.innerHTML = '<option value="">⚡ Auto-assign best available slot</option>' + 
      slots.map(s => `
        <option value="${s.slot_id}">${s.slot_number} &bull; ${s.location} (${s.vehicle_type})</option>
      `).join('');
  } catch (err) {
    console.error('Failed to load slots dropdown:', err);
  }
}

async function loadVehicles() {
  try {
    allVehicles = await api('/vehicles');
    renderVehicles();
  } catch (err) {
    document.getElementById('vehicleRows').innerHTML = `
      <tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">${esc(err.message)}</td></tr>
    `;
  }
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderVehicles();
}

function handleSearch() {
  renderVehicles();
}

function renderVehicles() {
  const search = (document.getElementById('vehicleSearch')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('vehicleRows');
  if (!tbody) return;

  let filtered = allVehicles.filter(v => {
    // Search matching
    const matchSearch = !search || 
      v.vehicle_number.toLowerCase().includes(search) ||
      v.owner_name.toLowerCase().includes(search) ||
      (v.phone && v.phone.toLowerCase().includes(search)) ||
      (v.vehicle_model && v.vehicle_model.toLowerCase().includes(search));

    if (!matchSearch) return false;

    // Filter status
    if (currentFilter === 'parked') return v.is_parked === 1;
    if (currentFilter === 'not-parked') return v.is_parked === 0;
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No matching vehicles found.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(v => `
    <tr>
      <td><b>#${v.vehicle_id}</b></td>
      <td>
        <div style="font-size:14px; font-weight:800; color:#0f172a; letter-spacing:0.5px;">${esc(v.vehicle_number)}</div>
      </td>
      <td>
        <span class="status ${v.vehicle_type}">${v.vehicle_type === 'Car' ? '🚗' : '🏍️'} ${esc(v.vehicle_type)}</span>
        <div style="font-size:12px; color:#475569; margin-top:3px;">${esc(v.vehicle_model)}</div>
      </td>
      <td>
        <b>${esc(v.owner_name)}</b>
        <div style="font-size:11px; color:#64748b;">📞 ${esc(v.phone)} &bull; ✉️ ${esc(v.email)}</div>
      </td>
      <td>
        ${v.is_parked 
          ? `<span class="status Occupied">🅿️ Parked in ${esc(v.current_slot)}</span>
             <div style="font-size:10px; color:#92400e; margin-top:3px;">Since: ${dt(v.parked_at)}</div>`
          : `<span class="status Available">⚪ Not Parked</span>`
        }
      </td>
      <td>
        ${v.is_parked 
          ? `<button class="btn primary sm" onclick="checkoutVehicleFromVehicles(${v.active_record_id})">Check out</button>`
          : `<button class="btn outline sm" onclick="prefillVehicle('${esc(v.owner_name)}', '${esc(v.phone)}', '${esc(v.email)}', '${esc(v.vehicle_number)}', '${esc(v.vehicle_type)}', '${esc(v.vehicle_model)}')">Assign Slot</button>`
        }
      </td>
    </tr>
  `).join('');
}

function prefillVehicle(name, phone, email, plate, type, model) {
  const form = document.getElementById('vehicleForm');
  if (!form) return;
  form.elements['name'].value = name;
  form.elements['phone'].value = phone;
  form.elements['email'].value = email;
  form.elements['vehicleNumber'].value = plate;
  form.elements['vehicleType'].value = type;
  form.elements['vehicleModel'].value = model;

  updateAvailableSlotsDropdown();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast(`Pre-filled ${plate} for quick slot assignment.`, 'info');
}

async function checkoutVehicleFromVehicles(recordId) {
  if (!confirm(`Check out vehicle record #${recordId}?`)) return;
  try {
    const res = await api(`/parking/exit/${recordId}`, { method: 'POST' });
    showToast(`Vehicle checked out! Fee: ${money(res.fee)}`, 'success');
    loadVehicles();
    updateAvailableSlotsDropdown();
    renderReceiptModal(res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Receipt Modal Handler
function renderReceiptModal(data) {
  const modal = document.getElementById('receiptModal');
  const body = document.getElementById('receiptBody');
  if (!modal || !body) return;

  const fee = data.fee || data.total_fee || '0.00';
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
        <span>Vehicle:</span>
        <span><b>${esc(data.vehicleNumber || data.vehicle_number)}</b> (${esc(data.vehicleType || data.vehicle_type)})</span>
      </div>
      <div class="receipt-row">
        <span>Slot:</span>
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
        <span>Duration:</span>
        <span>${hours} hour(s)</span>
      </div>
      <div class="receipt-row">
        <span>Rate:</span>
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

// Form Submission
document.getElementById('vehicleForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('vehicleMessage');
  const submitBtn = document.getElementById('submitBtn');

  submitBtn.disabled = true;
  msg.className = 'form-message';
  msg.textContent = 'Allocating parking slot...';

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const res = await api('/parking/entry', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    msg.className = 'form-message success';
    msg.textContent = `✅ ${res.message}`;
    showToast(`Assigned Slot ${res.slot}!`, 'success');

    e.target.reset();
    updateAvailableSlotsDropdown();
    loadVehicles();
  } catch (err) {
    msg.className = 'form-message error';
    msg.textContent = `❌ ${err.message}`;
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateAvailableSlotsDropdown();
  loadVehicles();
});
