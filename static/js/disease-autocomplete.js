/* disease-autocomplete.js
   Robust disease -> NAMASTE/ICD-11 autocomplete with auto-init fallback.
   - Place at: static/js/disease-autocomplete.js
   - Exposes window.initDiseaseAutofill() for manual init/debug.
   - Auto-initializes if it detects a logged-in clinician or visible dashboard.
*/

(function(){
  const DISEASE_ID = 'disease';
  const SUG_ID = 'diseaseSuggestions';
  const NAMASTE_ID = 'd_namaste';
  const ICD_ID = 'd_icd11';
  const MAX_SUG = 8;
  let CODES = { namaste: [], icd11: [] };
  let flat = []; // flattened suggestions [{type,item,el}]
  let active = -1;

  // ---------------- utilities ----------------
  function normalize(s){ return (s||'').toString().trim().toLowerCase(); }
  function debounce(fn, ms=220){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

  // ---------------- load codes ----------------
  async function loadCodes(){
    // prefer /api/codes (backend), fallback to static file
    try {
      const r = await fetch('/api/codes');
      if(r.ok){
        const j = await r.json();
        if(j && (Array.isArray(j.namaste) || Array.isArray(j.icd11))){
          CODES = j;
          window.__codes_debug = CODES;
          return CODES;
        }
      }
    } catch(e){
      // ignore, fallback next
    }
    try {
      const r2 = await fetch('/static/data/codes.json');
      if(r2.ok){
        CODES = await r2.json();
        window.__codes_debug = CODES;
        return CODES;
      }
    } catch(e){
      console.warn('disease-autocomplete: failed to load codes', e);
    }
    // if nothing loaded, keep empty arrays
    CODES = { namaste: [], icd11: [] };
    window.__codes_debug = CODES;
    return CODES;
  }

  // ---------------- matching & rendering ----------------
  function findMatches(q){
    q = normalize(q);
    if(!q) return { namaste: [], icd11: [] };
    const nm = (CODES.namaste||[]).filter(c => normalize(c.display).includes(q) || normalize(c.code).includes(q)).slice(0, MAX_SUG);
    const ic = (CODES.icd11||[]).filter(c => normalize(c.display).includes(q) || normalize(c.code).includes(q)).slice(0, MAX_SUG);
    return { namaste: nm, icd11: ic };
  }

  function clearSuggestions(){
    const box = document.getElementById(SUG_ID);
    if(!box) return;
    box.innerHTML = '';
    box.style.display = 'none';
    box.setAttribute('aria-expanded','false');
    flat = []; active = -1;
  }

  function makeItem(type, item){
    const div = document.createElement('div');
    div.className = 'sugg-item';
    div.setAttribute('role','option');
    div.dataset.type = type;
    div.dataset.code = item.code;
    div.dataset.display = item.display;
    div.innerHTML = `<strong style="margin-right:8px">${escapeHtml(item.code)}</strong>${escapeHtml(item.display)}`;
    return div;
  }

  function renderMatches(matches){
    const box = document.getElementById(SUG_ID);
    const inp = document.getElementById(DISEASE_ID);
    if(!box || !inp) return;
    box.innerHTML = '';
    flat = []; active = -1;

    function addGroup(title, arr, typeLabel){
      if(!arr || arr.length === 0) return;
      const h = document.createElement('div');
      h.className = 'sugg-group';
      h.innerText = title;
      box.appendChild(h);
      arr.forEach(it => {
        const el = makeItem(typeLabel, it);
        box.appendChild(el);
        flat.push({type: typeLabel, item: it, el});
        el.addEventListener('mouseenter', ()=> setActiveByEl(el));
        el.addEventListener('mouseleave', ()=> setActive(-1));
        el.addEventListener('click', ()=> choose(el));
      });
    }

    addGroup('NAMASTE matches', matches.namaste, 'namaste');
    addGroup('ICD-11 matches', matches.icd11, 'icd');

    if(flat.length === 0){
      clearSuggestions();
      return;
    }

    // position
    const rect = inp.getBoundingClientRect();
    box.style.minWidth = Math.max(inp.offsetWidth, 240) + 'px';
    box.style.display = 'block';
    box.style.top = (rect.bottom + window.scrollY) + 'px';
    box.style.left = (rect.left + window.scrollX) + 'px';
    box.setAttribute('aria-expanded','true');
  }

  function setActive(n){
    flat.forEach((f, i) => f.el.classList.toggle('active', i === n));
    active = n;
  }
  function setActiveByEl(el){
    const idx = flat.findIndex(f => f.el === el);
    setActive(idx);
  }

  function choose(el){
    if(!el) return;
    const type = el.dataset.type;
    const code = el.dataset.code;
    const display = el.dataset.display;
    const diseaseInput = document.getElementById(DISEASE_ID);
    const namInput = document.getElementById(NAMASTE_ID) || document.getElementById('namaste');
    const icdInput = document.getElementById(ICD_ID) || document.getElementById('icd11');

    if(diseaseInput) diseaseInput.value = display || '';
    if(type === 'namaste'){
      if(namInput) namInput.value = `${code} — ${display}`;
      // try to fill ICD by approximate match on display
      const ic = (CODES.icd11||[]).find(c=> normalize(c.display).includes(normalize(display)));
      if(ic && icdInput) icdInput.value = `${ic.code} — ${ic.display}`;
    } else {
      if(icdInput) icdInput.value = `${code} — ${display}`;
      const nm = (CODES.namaste||[]).find(c=> normalize(c.display).includes(normalize(display)));
      if(nm && namInput) namInput.value = `${nm.code} — ${nm.display}`;
    }
    clearSuggestions();
    // focus note if present
    const note = document.getElementById('d_note') || document.getElementById('note');
    if(note) note.focus();
  }

  function onKeyDown(e){
    if(flat.length === 0) return;
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      let n = (active + 1) % flat.length;
      setActive(n);
      flat[n].el.scrollIntoView({block:'nearest'});
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      let n = (active - 1 + flat.length) % flat.length;
      setActive(n);
      flat[n].el.scrollIntoView({block:'nearest'});
    } else if(e.key === 'Enter'){
      if(active >= 0){
        e.preventDefault();
        choose(flat[active].el);
      }
    } else if(e.key === 'Escape'){
      clearSuggestions();
    }
  }

  // ---------------- escape html for safety when injecting text nodes ----------------
  function escapeHtml(s){
    return (s||'').toString().replace(/[&<>"']/g, function(m){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }

  // ---------------- main input handler ----------------
  const onInputDebounced = debounce(async function(e){
    try {
      if(!CODES.namaste || !CODES.icd11) await loadCodes();
      const q = e.target.value;
      if(!q || q.trim().length === 0){ clearSuggestions(); return; }
      const matches = findMatches(q);
      renderMatches(matches);
    } catch(err){
      console.error('disease-autocomplete:onInput error', err);
    }
  }, 220);

  // ---------------- initialization ----------------
  async function initDiseaseAutofill(){
    // idempotent
    try {
      const inp = document.getElementById(DISEASE_ID);
      const box = document.getElementById(SUG_ID);
      if(!inp || !box){
        // not present on this page
        return;
      }
      // ensure codes loaded (but do not block UI)
      loadCodes().catch(()=>{ /* ignore */ });

      // style container defensively
      box.style.position = 'absolute';
      box.style.zIndex = 9999;
      box.style.display = 'none';
      box.style.background = '#fff';
      box.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      box.style.maxHeight = '320px';
      box.style.overflow = 'auto';

      // bind events (do not duplicate)
      if(!inp.__disease_autofill_inited){
        inp.addEventListener('input', onInputDebounced);
        inp.addEventListener('keydown', onKeyDown);
        document.addEventListener('click', (ev) => {
          if(ev.target === inp) return;
          const b = document.getElementById(SUG_ID);
          if(b && b.contains(ev.target)) return;
          clearSuggestions();
        });
        inp.__disease_autofill_inited = true;
      }
    } catch(e){
      console.warn('initDiseaseAutofill error', e);
    }
  }

  // expose globally for manual invocation/debug
  window.initDiseaseAutofill = initDiseaseAutofill;

  // ---------------- auto-init logic ----------------
  function shouldAutoInit(){
    try {
      // if clinician token present OR dashboard visible OR clinician page is loaded
      if(localStorage && (localStorage.getItem('clinician_token') || localStorage.getItem('clinician_user'))) return true;
      const dash = document.getElementById('dashboard');
      if(dash && dash.style && dash.style.display !== 'none') return true;
      // otherwise, if clinician.html is the current page (heuristic)
      if(window.location.pathname && window.location.pathname.includes('clinician')) return true;
    } catch(e){
      // ignore
    }
    return false;
  }

  // attempt auto-init once DOM is ready; keep trying a couple times in case of race conditions
  function tryAutoInitTries(tries = 6, interval = 150){
    if(typeof window.initDiseaseAutofill !== 'function') return;
    const attempt = async ()=>{
      try {
        if(shouldAutoInit()){
          await window.initDiseaseAutofill();
          // console.info('disease-autofill: auto-initialized');
          return;
        }
      } catch(e){
        // ignore
      }
      if(tries-- > 0){
        setTimeout(attempt, interval);
      }
    };
    setTimeout(attempt, 50);
  }

  // run auto-init attempts on DOMContentLoaded or immediately if already ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> tryAutoInitTries());
  } else {
    tryAutoInitTries();
  }

  // also expose a convenience function to forcibly initialize (useful in console)
  window.__disease_autofill_force_init = async function(){
    try {
      await initDiseaseAutofill();
      console.log('disease-autofill: forced init done');
    } catch(e){
      console.warn('disease-autofill forced init failed', e);
    }
  };

})();

