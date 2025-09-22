// static/js/clinician.js
// Clinician portal logic: login, create patient, create diagnosis, list records
// FHIR links removed from UI output.

let currentToken = null;
let currentUser = null;
let selectedRecordId = null;

async function login(ev){
  ev.preventDefault();
  const u = document.getElementById('username').value;
  const pw = document.getElementById('password').value;
  const params = new URLSearchParams();
  params.append('username', u);
  params.append('password', pw);
  const r = await fetch('/api/login', {method:'POST', body: params});
  const err = document.getElementById('err');
  err.innerText = '';
  if(!r.ok){
    const j = await r.json().catch(()=>({detail:'Login failed'}));
    err.innerText = j.detail || 'Login failed';
    return;
  }
  const data = await r.json();
  currentToken = data.access_token;
  currentUser = data.username;
  localStorage.setItem('clinician_token', currentToken);
  localStorage.setItem('clinician_user', currentUser);
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('who').innerText = 'Clinician: ' + currentUser;
  await loadCodes();
  await refreshRecords();
  // initialize autocomplete if present
  if(typeof window.initDiseaseAutofill === 'function'){
    try { window.initDiseaseAutofill(); } catch(e) { console.warn('initDiseaseAutofill failed', e); }
  }
}

function logout(){
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('clinician_token');
  localStorage.removeItem('clinician_user');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginBox').style.display = 'block';
}

async function authFetch(path, opts = {}){
  opts.headers = opts.headers || {};
  const token = currentToken || localStorage.getItem('clinician_token');
  if(token){
    opts.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(path, opts);
}

let CODES_CACHE = null;
async function loadCodes(){
  // fill datalists (used by manual code input)
  try {
    const r = await fetch('/api/codes');
    if(r.ok){
      CODES_CACHE = await r.json();
    } else {
      const r2 = await fetch('/static/data/codes.json');
      if(r2.ok) CODES_CACHE = await r2.json();
    }
  } catch(e){
    try{
      const r2 = await fetch('/static/data/codes.json');
      if(r2.ok) CODES_CACHE = await r2.json();
    } catch(_){}
  }
  const namasteList = document.getElementById('namasteList');
  const icd11List = document.getElementById('icd11List');
  if(namasteList) namasteList.innerHTML = '';
  if(icd11List) icd11List.innerHTML = '';
  for(const c of (CODES_CACHE && CODES_CACHE.namaste||[])){
    const opt = document.createElement('option');
    opt.value = `${c.code} — ${c.display}`;
    namasteList && namasteList.appendChild(opt);
  }
  for(const c of (CODES_CACHE && CODES_CACHE.icd11||[])){
    const opt = document.createElement('option');
    opt.value = `${c.code} — ${c.display}`;
    icd11List && icd11List.appendChild(opt);
  }
}

async function submitPatient(ev){
  ev.preventDefault();
  const name = document.getElementById('p_name').value;
  const dob = document.getElementById('p_dob').value;
  const gender = document.getElementById('p_gender').value;
  const contact = document.getElementById('p_contact').value;
  const payload = {name,dob,gender,contact};
  const r = await authFetch('/api/patients', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const s = document.getElementById('patientStatus');
  if(!r.ok){
    const j = await r.json().catch(()=>({detail:'error'}));
    s.innerText = 'Error: ' + (j.detail || 'Could not save');
    s.style.color = 'red';
    return;
  }
  const saved = await r.json();
  s.innerText = `Saved patient ${saved.name} (id: ${saved.id})`;
  s.style.color = 'green';
  document.getElementById('d_patient_id').value = saved.id;
  await refreshRecords();
}

async function submitDiagnosis(ev){
  ev.preventDefault();
  const patient_id = document.getElementById('d_patient_id').value;
  const namaste = (document.getElementById('d_namaste').value || '').split(' — ')[0] || document.getElementById('d_namaste').value;
  const icd11 = (document.getElementById('d_icd11').value || '').split(' — ')[0] || document.getElementById('d_icd11').value;
  const note = document.getElementById('d_note').value;
  const payload = {patient_id, namaste_code: namaste, icd11_code: icd11, note};
  const r = await authFetch('/api/diagnoses', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const s = document.getElementById('diagStatus');
  if(!r.ok){
    const j = await r.json().catch(()=>({detail:'error'}));
    s.innerText = 'Error: ' + (j.detail || 'Could not save');
    s.style.color = 'red';
    return;
  }
  const saved = await r.json();
  // FHIR link removed: minimal confirmation only
  s.innerText = `Saved diagnosis ${saved.id} for patient ${saved.patient_id}.`;
  s.style.color = 'green';
  await refreshRecords();
}

async function refreshRecords(){
  const r = await authFetch('/api/records');
  const container = document.getElementById('records');
  container.innerHTML = '';
  if(!r.ok){
    const j = await r.json().catch(()=>({detail:'error'}));
    container.innerText = 'Error: ' + (j.detail || 'Could not fetch');
    container.style.color = 'red';
    return;
  }
  const data = await r.json();
  if(!data || data.length === 0){
    container.innerText = 'No records found.';
    return;
  }
  data.forEach(rec => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.cursor = 'pointer';
    let inner = '';
    if(rec.type === 'patient' || rec.name){
      inner += `<strong>Patient</strong><br/>Name: ${rec.name || ''}<br/>ID: ${rec.id || ''}<br/>DOB: ${rec.dob || ''}<br/>Gender: ${rec.gender || ''}`;
    } else {
      inner += `<strong>Diagnosis</strong><br/>ID: ${rec.id}<br/>Patient: ${rec.patient_id || ''}<br/>NAMASTE: ${rec.namaste_code || ''}<br/>ICD-11: ${rec.icd11_code || ''}<br/>Note: ${rec.note || ''}`;
    }
    // NOTE: FHIR link intentionally removed here.
    el.innerHTML = inner;
    el.addEventListener('click', ()=> {
      selectedRecordId = rec.id;
      document.getElementById('d_patient_id').value = rec.patient_id || rec.id;
      document.getElementById('d_note').value = rec.note || '';
      document.getElementById('diagStatus').innerText = '';
    });
    container.appendChild(el);
  });
}

function initFromStorage(){
  const token = localStorage.getItem('clinician_token');
  const user = localStorage.getItem('clinician_user');
  if(token && user){
    currentToken = token;
    currentUser = user;
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('who').innerText = 'Clinician: ' + currentUser;
    loadCodes();
    refreshRecords();
    if(typeof window.initDiseaseAutofill === 'function'){
      try { window.initDiseaseAutofill(); } catch(e) { console.warn('initDiseaseAutofill error', e); }
    }
  }
}

// wire events
document.getElementById('loginForm').addEventListener('submit', login);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('patientForm').addEventListener('submit', submitPatient);
document.getElementById('diagForm').addEventListener('submit', submitDiagnosis);
document.getElementById('refreshBtn').addEventListener('click', refreshRecords);
document.getElementById('fillFromSelected').addEventListener('click', ()=> {
  if(selectedRecordId){
    document.getElementById('d_patient_id').value = selectedRecordId;
  }
});
initFromStorage();


