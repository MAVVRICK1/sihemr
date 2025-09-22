async function getCodes(){
  const r = await fetch('/api/codes');
  return r.ok ? r.json() : {namaste:[], icd11:[]};
}

async function submit(ev){
  ev.preventDefault();
  const name = document.getElementById('name').value;
  const dob = document.getElementById('dob').value;
  const gender = document.getElementById('gender').value;
  const contact = document.getElementById('contact').value;
  const namaste = document.getElementById('namaste').value;
  const icd11 = document.getElementById('icd11').value;
  const note = document.getElementById('note').value;

  const patientResp = await fetch('/api/patients', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name,dob,gender,contact})
  });
  const patient = await patientResp.json();
  const diagResp = await fetch('/api/diagnoses', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({patient_id:patient.id, namaste_code:namaste, icd11_code:icd11, note})
  });
  const diag = await diagResp.json();
  const status = document.getElementById('status');
  status.innerHTML = `Saved patient ${patient.name} and diagnosis ${diag.id}. <a href="/api/records/${diag.id}/fhir" target="_blank">Open FHIR bundle</a>`;
}

async function init(){
  const codes = await getCodes();
  const namasteList = document.getElementById('namasteList');
  const icd11List = document.getElementById('icd11List');
  for(const c of (codes.namaste||[])){
    const opt = document.createElement('option');
    opt.value = `${c.code} — ${c.display}`;
    namasteList.appendChild(opt);
  }
  for(const c of (codes.icd11||[])){
    const opt = document.createElement('option');
    opt.value = `${c.code} — ${c.display}`;
    icd11List.appendChild(opt);
  }
  document.getElementById('patientForm').addEventListener('submit', submit);
}

init();

