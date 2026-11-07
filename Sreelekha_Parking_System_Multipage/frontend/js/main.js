// Sreelekha Parking Management System - Shared Client JavaScript

// 1. Dynamic Navigation Bar
(function initNav() {
  const navTarget = document.getElementById('app-nav');
  if (!navTarget) return;

  const links = [
    { url: 'home.html', label: 'Home', icon: '🏠' },
    { url: 'dashboard.html', label: 'Dashboard', icon: '📊' },
    { url: 'vehicles.html', label: 'Vehicles', icon: '🚗' },
    { url: 'parking-slots.html', label: 'Parking Slots', icon: '🅿️' },
    { url: 'parking-records.html', label: 'Records', icon: '🧾' },
    { url: 'users.html', label: 'Users', icon: '👥' },
    { url: 'about.html', label: 'About', icon: 'ℹ️' },
    { url: 'contact.html', label: 'Contact', icon: '📞' }
  ];

  const current = location.pathname.split('/').pop() || 'home.html';

  navTarget.innerHTML = `
    <nav class="navbar">
      <a class="brand" href="home.html">
        <div class="brand-mark">S</div>
        <div>
          <div class="brand-text">SREELEKHA</div>
          <small>PARKING SYSTEM</small>
        </div>
      </a>
      <div class="navlinks">
        ${links.map(link => `
          <a class="${current === link.url ? 'active' : ''}" href="${link.url}">
            <span>${link.icon}</span> ${link.label}
          </a>
        `).join('')}
      </div>
    </nav>
  `;
})();

// 2. Dynamic Footer
(function initFooter() {
  const footerTarget = document.getElementById('app-footer');
  if (!footerTarget) return;

  footerTarget.innerHTML = `
    <footer>
      <div class="container" style="margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <b>Sreelekha Parking Management System</b> &bull; Academic Mini Project
        </div>
        <div>
          Node.js &bull; Express &bull; MySQL &bull; Multipage Architecture
        </div>
      </div>
    </footer>
  `;
})();

// 3. API Fetch Helper
async function api(endpoint, options = {}) {
  try {
    const res = await fetch('/api' + endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error('API call error:', err);
    throw err;
  }
}

// 4. Utility Formatters
function money(val) {
  return '₹' + Number(val || 0).toFixed(2);
}

function dt(val) {
  if (!val) return '—';
  const clean = String(val).replace(' ', 'T');
  const d = new Date(clean);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 5. Toast / Notification Helper
function showToast(message, type = 'info') {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.style.position = 'fixed';
    box.style.bottom = '24px';
    box.style.right = '24px';
    box.style.zIndex = '9999';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '8px';
    document.body.appendChild(box);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2563eb';
  toast.style.background = bgColor;
  toast.style.color = '#fff';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
  toast.style.animation = 'fadeIn 0.2s ease';
  toast.textContent = message;

  box.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
