// static/js/patient.js
// Patient login + view personal records with Logout button and preserved fallback behavior.

(function(){
  const loginForm = document.getElementById('patientLoginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const errEl = document.getElementById('err');
  const loginBox = document.getElementById('loginBox');
  const dash = document.getElementById('dashboard');
  const who = document.getElementById('who');
  const whoId = document.getElementById('whoId');
  const recordsEl = document.getElementById('records');
  const refreshBtn = document.getElementById('refreshBtn');
  const statusEl = document.getElementById('status');

  // localStorage keys
  const TOKEN_KEY = 'patient_token';
  const USER_KEY = 'patient_user';
  const USER_ID_KEY = 'patient_id';

  function setStatus(msg){
    statusEl.innerText = msg || '';
  }

  async function login(ev){
    ev && ev.preventDefault();
    errEl.innerText = '';
    const username = document.getElementById('p_username').value;
    const password = document.getElementById('p_password').value;
    if(!username || !password){
      errEl.innerText = 'Enter username and password';
      return;
    }
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      const r = await fetch('/api/login', { method: 'POST', body: params });
      if(!r.ok){
        const j = await r.json().catch(()=>({detail: 'login failed'}));
        errEl.innerText = j.detail || 'Login failed';
        return;
      }
      const data = await r.json();
      const token = data.access_token || data.token || null;
      const uname = data.username || username;
      if(token) localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, uname);
      if(data.user_id || data.id) localStorage.setItem(USER_ID_KEY, data.user_id || data.id);
      // clear password field for safety
      document.getElementById('p_password').value = '';
      showDashboard(uname);
      await loadMyRecords();
    } catch(e){
      console.error(e);
      errEl.innerText = 'Login error';
    }
  }

  function logout(){
    // Clear stored auth and UI state
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_ID_KEY);

    // Hide dashboard, show login box
    loginBox.style.display = 'block';
    dash.style.display = 'none';
    errEl.innerText = '';
    recordsEl.innerHTML = '';
    setStatus('');
    // optionally clear username input
    document.getElementById('p_username').value = '';
    document.getElementById('p_password').value = '';

    // If any in-memory variables exist, clear them (defensive)
    // No global token var here, but if any exist they should be reset
    try {
      if(window.__patient_cached_token) delete window.__patient_cached_token;
    } catch(e){}

    // Focus username for easier re-login
    const userInput = document.getElementById('p_username');
    if(userInput) userInput.focus();
  }

  function authFetch(path, opts = {}){
    opts.headers = opts.headers || {};
    const token = localStorage.getItem(TOKEN_KEY);
    if(token){
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    return fetch(path, opts);
  }

  async function showDashboard(username){
    loginBox.style.display = 'none';
    dash.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    who.innerText = 'Patient: ' + (username || localStorage.getItem(USER_KEY) || '');
    whoId.innerText = localStorage.getItem(USER_ID_KEY) ? ('ID: ' + localStorage.getItem(USER_ID_KEY)) : '';
  }

  // Primary: call /api/myrecords which should return only this patient's records
  async function loadMyRecords(){
    recordsEl.innerHTML = '';
    setStatus('Loading records...');
    // first try the dedicated endpoint
    try {
      const r = await authFetch('/api/myrecords');
      if(r.ok){
        const data = await r.json();
        renderRecords(data);
        setStatus('');
        return;
      }
      // if 401/403/404 or other, fall through to fallback
    } catch(e){
      console.warn('myrecords endpoint failed', e);
    }

    // FALLBACK: try to fetch all records and filter client-side
    try {
      const r2 = await authFetch('/api/records');
      if(!r2.ok){
        setStatus('Could not load records (backend error)');
        return;
      }
      const all = await r2.json();
      const userId = localStorage.getItem(USER_ID_KEY);
      const username = localStorage.getItem(USER_KEY);
      let filtered = [];
      if(userId){
        filtered = all.filter(rec => String(rec.patient_id) === String(userId) || String(rec.id) === String(userId));
      } else if(username){
        filtered = all.filter(rec => (rec.username && rec.username === username) || (rec.name && rec.name.toLowerCase().includes(username.toLowerCase())) || (rec.patient_name && rec.patient_name.toLowerCase().includes(username.toLowerCase())));
      } else {
        filtered = []; // can't determine
      }
      renderRecords(filtered);
      setStatus('');
    } catch(e){
      console.error(e);
      setStatus('Could not load records');
    }
  }

  function renderRecords(list){
    recordsEl.innerHTML = '';
    if(!list || list.length === 0){
      recordsEl.innerHTML = '<div class="muted">No records found.</div>';
      return;
    }
    list.forEach(rec => {
      const el = document.createElement('div');
      el.className = 'record';
      let html = '';
      if(rec.type === 'patient' || rec.name || rec.patient_name){
        html += `<strong>Patient</strong><br/>Name: ${escapeHtml(rec.name || rec.patient_name || '')} <br/>ID: ${escapeHtml(rec.id || rec.patient_id || '')}`;
        if(rec.dob) html += `<br/>DOB: ${escapeHtml(rec.dob)}`;
      } else {
        html += `<strong>Diagnosis</strong><br/>ID: ${escapeHtml(rec.id || '')} <br/>Patient ID: ${escapeHtml(rec.patient_id || '')}<br/>NAMASTE: ${escapeHtml(rec.namaste_code || '')}<br/>ICD-11: ${escapeHtml(rec.icd11_code || '')}<br/>Note: ${escapeHtml(rec.note || '')}`;
      }
      el.innerHTML = html;
      recordsEl.appendChild(el);
    });
  }

  function escapeHtml(s){
    return (s||'').toString().replace(/[&<>"']/g, function(m){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }

  // setup event listeners
  loginForm.addEventListener('submit', login);
  logoutBtn.addEventListener('click', logout);
  refreshBtn.addEventListener('click', loadMyRecords);

  // initialize if already logged in
  (async function init(){
    const existing = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if(existing && token){
      // attempt to show dashboard and load records; if token invalid, loadMyRecords will fail and user can re-login
      await showDashboard(existing);
      await loadMyRecords();
    } else {
      // ensure login UI visible and logout hidden
      loginBox.style.display = 'block';
      dash.style.display = 'none';
      logoutBtn.style.display = 'none';
    }
  })();
})();


