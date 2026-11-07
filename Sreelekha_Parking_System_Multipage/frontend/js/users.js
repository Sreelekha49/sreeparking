// Sreelekha Parking Management System - Users Controller

let allUsers = [];

async function loadUsers() {
  const tbody = document.getElementById('userRows');
  if (!tbody) return;

  try {
    allUsers = await api('/users');
    renderUsers();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">${esc(err.message)}</td></tr>`;
  }
}

function toggleAddUserForm() {
  const panel = document.getElementById('addUserPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    panel.scrollIntoView({ behavior: 'smooth' });
  }
}

function renderUsers() {
  const tbody = document.getElementById('userRows');
  if (!tbody) return;

  const search = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();

  const filtered = allUsers.filter(u => {
    return !search ||
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.phone.toLowerCase().includes(search);
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">No matching users found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td><b>#${u.user_id}</b></td>
      <td>
        <b>${esc(u.name)}</b>
      </td>
      <td>
        <span class="status ${u.role === 'Admin' ? 'Active' : u.role === 'Security Staff' ? 'Occupied' : 'Completed'}">
          ${esc(u.role)}
        </span>
      </td>
      <td>${esc(u.phone)}</td>
      <td>${esc(u.email)}</td>
      <td>
        <span style="font-weight:700; color:#2563eb;">${u.vehicle_count || 0}</span> vehicle(s)
      </td>
      <td>
        <span style="font-weight:700; color:#10b981;">${u.record_count || 0}</span> session(s)
      </td>
    </tr>
  `).join('');
}

async function submitAddUser(e) {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('userFormMsg');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  msg.className = 'form-message';
  msg.textContent = 'Saving user account...';

  try {
    const res = await api('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    msg.className = 'form-message success';
    msg.textContent = `✅ ${res.message}`;
    showToast(res.message, 'success');
    form.reset();
    setTimeout(() => toggleAddUserForm(), 1200);
    loadUsers();
  } catch (err) {
    msg.className = 'form-message error';
    msg.textContent = `❌ ${err.message}`;
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadUsers);
