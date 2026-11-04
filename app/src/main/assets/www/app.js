(() => {
'use strict';

/* ───────── utilidades ───────── */
const TELON_VERSION = 2;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('telon.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('telon.' + k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } }
};
const COLORS = ['#7B61FF', '#E8364F', '#2563EB', '#D946EF', '#0D9488', '#EA580C'];
const PROFILE_COLORS = ['#B23A48', '#2F6DB5', '#2E8B6A', '#9B59B6', '#E67E22', '#1ABC9C'];

/* ───────── perfiles ───────── */
const profiles = {
  all() { return store.get('profiles', []); },
  save(list) { store.set('profiles', list); },
  active() { const id = store.get('activeProfile', null); const all = this.all(); return all.find(p => p.id === id) || all[0] || null; },
  setActive(id) { store.set('activeProfile', id); },
  add(name, color) { const list = this.all(); const p = { id: Date.now().toString(36), name, color, pin: '' }; list.push(p); this.save(list); return p; },
  remove(id) { const list = this.all().filter(p => p.id !== id); this.save(list); if (store.get('activeProfile') === id && list.length) this.setActive(list[0].id); },
  update(id, changes) { const list = this.all(); const p = list.find(x => x.id === id); if (p) Object.assign(p, changes); this.save(list); }
};
const colorFor = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]; };
const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const I = {
  search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  refresh: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  playBig: '<svg width="36" height="36" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
  addons: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13v7M13 16.5h7"/></svg>',
  lib: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>',
  save: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>',
  saveOn: '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>',
  eps: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  layers: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  vol: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  mute: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
  trash: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  speed: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6l4 2"/></svg>',
  subs: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/></svg>',
  subsOff: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/><path d="M4 4l16 16" stroke-width="2.5"/></svg>',
  gear: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

/* ───────── estado ───────── */
const S = {
  tab: 'home', filter: 'all', filterType: 'all', filterGenre: 'all', libTab: 'list', searchOpen: false, q: '',
  profileScreen: !profiles.all().length,
  addons: [],     // hardcoded, se cargan al inicio
  lib: store.get('lib', []),           // [{ base, type, id, name, poster, country }]
  hist: store.get('hist', {}),         // key → entrada de historial
  rows: null, rowErrors: 0, loading: false,
  searchRows: null, searching: false,
  addUrl: '', adding: false, addErr: '', confirmDel: null,
  detail: null, player: null
};
const refKey = r => r.base + '|' + r.type + '|' + r.id;
const saveAddons = () => store.set('addons', S.addons);
const saveLib = () => store.set('lib', S.lib);
const saveHist = () => {
  const ents = Object.values(S.hist).sort((a, b) => b.ts - a.ts);
  S.hist = {}; ents.slice(0, 60).forEach(e => { S.hist[e.key] = e; });
  store.set('hist', S.hist);
};

/* ───────── red y protocolo de addons ───────── */
const normBase = u => u.trim().replace(/^stremio:\/\//i, 'https://').replace(/\/manifest\.json.*$/i, '').replace(/\/+$/, '');
async function getJSON(url, ms = 15000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'tiempo de espera agotado' : e.message);
  } finally { clearTimeout(t); }
}
const resName = r => typeof r === 'string' ? r : r.name;
function resOk(a, name, type, id) {
  for (const r of (a.manifest.resources || [])) {
    if (resName(r) !== name) continue;
    const o = typeof r === 'object' ? r : {};
    const types = o.types || a.manifest.types, pre = o.idPrefixes || a.manifest.idPrefixes;
    if (type && types && types.length && !types.includes(type)) continue;
    if (id && pre && pre.length && !pre.some(p => String(id).startsWith(p))) continue;
    return true;
  }
  return false;
}
const enabled = () => S.addons.filter(a => a.enabled);
const url = (a, res, type, id, extra) => `${a.base}/${res}/${type}/${encodeURIComponent(id)}${extra ? '/' + extra : ''}.json`;

const countryOf = m => {
  let c = m && (m.country || m.countries);
  if (Array.isArray(c)) c = c[0];
  if (!c) return '';
  c = String(c).trim();
  const up = c.toUpperCase();
  if (/^(CN|CHINA|CHINO|CHINESE)/.test(up)) return 'CN';
  if (/^(US|USA|EEUU|UNITED STATES|ESTADOS UNIDOS)/.test(up)) return 'US';
  if (/^(KR|KOREA|COREA|KOREAN)/.test(up)) return 'KR';
  if (/^(JP|JAP[AÓO]N|JAPANESE)/.test(up)) return 'JP';
  if (/^(TH|THAI|TAILAND)/.test(up)) return 'TH';
  if (/^(TW|TAIW[AÁ]N)/.test(up)) return 'TW';
  if (/^(ES|ESPA[ÑN]A|SPANISH)/.test(up)) return 'ES';
  if (/^(MX|M[EÉ]XICO|MEXICAN)/.test(up)) return 'MX';
  if (/^(IN|INDIA)/.test(up)) return 'IN';
  if (/^(GB|UK|BRIT)/.test(up)) return 'UK';
  return up.slice(0, 2);
};
const countryLabel = c => ({ CN: 'China', US: 'EEUU', KR: 'Corea', JP: 'Japón', ES: 'España', MX: 'México', CO: 'Colombia', AR: 'Argentina', TH: 'Tailandia', TW: 'Taiwán', IN: 'India', UK: 'UK', GB: 'UK' }[c] || c);

/* ───────── toast ───────── */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.innerHTML = `<div>${esc(msg)}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => { t.innerHTML = ''; }, 3200);
}

/* ───────── piezas de interfaz ───────── */
function poster(m, extra = '') {
  const bg = colorFor(m.name);
  const img = m.poster ? `<img loading="lazy" src="${esc(m.poster)}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` : '';
  const c = countryOf(m);
  return `<div class="poster ${m.poster ? '' : 'noimg'}" style="background:${bg}">${img}${c ? `<span class="tag">${esc(c)}</span>` : ''}<span class="ptitle">${esc(m.name)}</span>${extra}</div>`;
}
const index = {}; // clave → { base, type, id, name, poster, country }
function card(a, type, m, extra = '', cls = '') {
  const ref = { base: a.base, type: m.type || type, id: m.id, name: m.name, poster: m.poster, country: countryOf(m), description: m.description };
  const k = refKey(ref); index[k] = ref;
  const meta = [(m.genres || [])[0], m.releaseInfo || m.year].filter(Boolean).join(' · ');
  return `<button class="card ${cls}" data-act="open" data-k="${esc(k)}">${poster(m, extra)}<span class="cname">${esc(m.name)}</span>${meta ? `<span class="cmeta">${esc(meta)}</span>` : ''}</button>`;
}
function emptyAddons() {
  return `<div class="empty"><h3>Todavía no tienes addons</h3><p>Telón no trae contenido propio: lo traen tus addons. Pega el enlace del <b>manifest.json</b> de uno para ver sus series aquí.</p><button class="btn" data-act="tab:addons">Añadir un addon</button></div>`;
}

/* ───────── pantalla: perfiles ───────── */
function pfAvatarHTML(p, size) {
  const s = size || 96;
  if (p.image) return `<span class="pf-avatar" style="background:${esc(p.color)}"><img src="${esc(p.image)}" style="width:${s}px;height:${s}px;border-radius:12px;object-fit:cover" onerror="this.remove()"></span>`;
  return `<span class="pf-avatar" style="background:${esc(p.color)}">${esc(p.name[0].toUpperCase())}</span>`;
}
function profileScreenHTML() {
  const list = profiles.all();
  const cards = list.map(p => `<button class="pf-card" data-act="pickprofile:${esc(p.id)}">${pfAvatarHTML(p)}<span class="pf-name">${esc(p.name)}</span></button>`).join('');
  const addCard = `<button class="pf-card" data-act="addprofile"><span class="pf-avatar pf-add"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="pf-name">Añadir perfil</span></button>`;
  return `<div class="pf-screen"><span class="pf-title">¿Quién está viendo?</span><div class="pf-grid">${cards}${addCard}</div>
    ${list.length ? `<div style="display:flex;gap:8px;margin-top:12px"><button class="btn out" data-act="editprofileimg">Cambiar foto</button><button class="btn out" data-act="manageprofiles">Administrar</button></div>` : ''}
    <input type="file" id="pffile" accept="image/*" style="display:none"></div>`;
}

/* ───────── pantalla: inicio ───────── */
function homeHTML() {
  const prof = profiles.active();
  const avatar = prof ? (prof.image ? `<button class="pf-mini" data-act="showprofiles" style="background:${esc(prof.color)};padding:0;overflow:hidden"><img src="${esc(prof.image)}" style="width:32px;height:32px;border-radius:16px;object-fit:cover" onerror="this.parentNode.textContent='${esc(prof.name[0].toUpperCase())}'"></button>` : `<button class="pf-mini" data-act="showprofiles" style="background:${esc(prof.color)}">${esc(prof.name[0].toUpperCase())}</button>`) : '';
  return `<header class="appbar"><span class="logo"><img src="logo.webp" alt="Telón" style="height:36px"></span><div style="display:flex">
    <button class="iconbtn" data-act="reloadaddons" aria-label="Recargar addons" title="Recargar addons">${I.refresh}</button>
    <button class="iconbtn" data-act="search" aria-label="Buscar">${I.search}</button>${avatar}</div></header>
    ${S.searchOpen ? `<div class="searchbar"><input id="q" type="search" placeholder="Buscar series, géneros, países…" value="${esc(S.q)}" autocomplete="off"></div>` : ''}
    <main class="scroll" id="homeBody"></main>`;
}
function homeBody() {
  const el = $('#homeBody'); if (!el) return;
  if (!S.addons.length) { el.innerHTML = emptyAddons(); return; }
  if (S.searchOpen && S.q.trim()) { el.innerHTML = searchHTML(); return; }
  if (S.loading && !S.rows) { el.innerHTML = '<div class="spin" role="progressbar" aria-label="Cargando"></div>'; return; }
  const rows = S.rows || [];
  if (!rows.length) {
    el.innerHTML = `<div class="empty"><h3>Sin catálogos</h3><p>${S.rowErrors ? 'Los addons no respondieron.' : 'Tus addons activos no ofrecen catálogos.'} Revisa que estén activos y que el servidor esté encendido.</p><div style="display:flex;gap:8px"><button class="btn" data-act="refresh">Reintentar</button><button class="btn out" data-act="tab:addons">Ver addons</button></div></div>`;
    return;
  }
  const codes = [...new Set(rows.flatMap(r => r.metas.map(countryOf)).filter(Boolean))];
  const genres = [...new Set(rows.flatMap(r => r.metas.flatMap(m => m.genres || [])).filter(Boolean))].sort();
  const types = [...new Set(rows.map(r => r.cat.type).filter(Boolean))];
  if (S.filter !== 'all' && !codes.includes(S.filter)) S.filter = 'all';
  if (S.filterGenre !== 'all' && !genres.includes(S.filterGenre)) S.filterGenre = 'all';
  if (S.filterType !== 'all' && !types.includes(S.filterType)) S.filterType = 'all';
  const typeLabels = { series: 'Series', movie: 'Películas', short: 'Cortos' };
  let chips = '';
  if (types.length > 1 || codes.length || genres.length) {
    const typeChips = types.length > 1 ? types.map(t => `<button class="chip ${S.filterType === t ? 'on' : ''}" data-act="ftype:${esc(t)}">${esc(typeLabels[t] || t)}</button>`).join('') : '';
    const countryChips = codes.map(c => `<button class="chip ${S.filter === c ? 'on' : ''}" data-act="filter:${esc(c)}">${esc(countryLabel(c))}</button>`).join('');
    const genreChips = genres.slice(0, 12).map(g => `<button class="chip ${S.filterGenre === g ? 'on' : ''}" data-act="fgenre:${esc(g)}">${esc(g)}</button>`).join('');
    chips = `<div class="chips"><button class="chip ${S.filter === 'all' && S.filterType === 'all' && S.filterGenre === 'all' ? 'on' : ''}" data-act="filterreset">Todo</button>${typeChips}${countryChips}${genreChips}</div>`;
  }
  const f = m => (S.filter === 'all' || countryOf(m) === S.filter) && (S.filterGenre === 'all' || (m.genres || []).includes(S.filterGenre));
  const shown = rows.map(r => ({ ...r, metas: r.metas.filter(f) })).filter(r => r.metas.length && (S.filterType === 'all' || r.cat.type === S.filterType));

  let hero = '';
  const first = shown[0] && shown[0].metas[0];
  if (first) {
    const a = shown[0].addon, ref = { base: a.base, type: first.type || shown[0].cat.type, id: first.id, name: first.name, poster: first.poster, country: countryOf(first) };
    const k = refKey(ref); index[k] = ref;
    const bgImg = first.background || first.poster;
    hero = `<button class="hero" data-act="open" data-k="${esc(k)}" style="background-color:${colorFor(first.name)};${bgImg ? `background-image:url('${esc(bgImg)}')` : ''}">
      <span class="badge">Destacado${countryOf(first) ? ' · ' + esc(countryOf(first)) : ''}</span>
      <span class="herorow"><span><h2>${esc(first.name)}</h2><div class="herosub">${esc([(first.genres || []).slice(0, 2).join(' · '), a.manifest.name].filter(Boolean).join(' · '))}</div></span><span class="playfab">${I.play}</span></span></button>`;
  }
  const hist = Object.values(S.hist).filter(h => h.t > 1).sort((a, b) => b.ts - a.ts).slice(0, 10);
  const cont = hist.length ? `<div class="section"><h2>Continuar viendo</h2><div class="row">${hist.map(h => {
    const pct = h.dur ? Math.min(100, Math.round(h.t / h.dur * 100)) : 0;
    return `<button class="card wide" data-act="resume" data-k="${esc(h.key)}">${poster({ name: h.name, poster: h.poster }, `<div class="prog"><i style="width:${pct}%"></i></div>`)}<span class="cname">${esc(h.name)}</span><span class="cmeta">${esc(h.label || '')}</span></button>`;
  }).join('')}</div></div>` : '';
  let lastAddonId = ''; const sections = shown.map(r => { const aid = r.addon.manifest.id; const horiz = aid === 'app.telon.sololatino'; let hdr = ''; if (aid !== lastAddonId) { lastAddonId = aid; const label = aid === 'app.telon.sololatino' ? 'Series' : aid === 'app.telon.nartodrama' ? 'Dramas Cortos' : r.addon.manifest.name; hdr = `<div class="section" style="margin-top:16px"><h2 style="font-size:26px;opacity:.5">${esc(label)}</h2></div>`; } return hdr + `<div class="section"><h2>${esc(r.cat.name || r.cat.id)}</h2><span class="sub">${esc(r.addon.manifest.name)}</span><div class="${horiz ? 'row' : 'grid3'}">${r.metas.map(m => card(r.addon, r.cat.type, m)).join('')}</div></div>`; }).join('');
  const err = S.rowErrors ? `<p class="hint" style="padding:0 16px">${S.rowErrors} catálogo(s) no respondieron.</p>` : '';
  el.innerHTML = chips + hero + cont + sections + err;
}
function searchHTML() {
  if (S.searching) return '<div class="spin" role="progressbar" aria-label="Buscando"></div>';
  const rows = S.searchRows || [];
  if (!rows.length) return `<div class="empty"><h3>Sin resultados</h3><p>Ningún addon devolvió resultados para «${esc(S.q)}». Solo buscan los catálogos que declaran soporte de búsqueda.</p></div>`;
  return rows.map(r => { const horiz = r.addon.manifest.id === 'app.telon.sololatino'; return `<div class="section"><h2>${esc(r.cat.name || r.cat.id)}</h2><span class="sub">${esc(r.addon.manifest.name)}</span><div class="${horiz ? 'row' : 'grid3'}">${r.metas.map(m => card(r.addon, r.cat.type, m)).join('')}</div></div>`; }).join('');
}
async function loadHome() {
  S.loading = true; S.rowErrors = 0; if (S.tab === 'home') homeBody();
  const jobs = [];
  for (const a of enabled()) {
    for (const c of (a.manifest.catalogs || [])) {
      if ((c.extra || []).some(e => e.isRequired) || (c.extraRequired || []).length) continue;
      jobs.push(getJSON(url(a, 'catalog', c.type, c.id)).then(j => ({ addon: a, cat: c, metas: (j.metas || []).filter(m => m && m.id && m.name) }))
        .catch(() => { S.rowErrors++; return null; }));
    }
  }
  S.rows = (await Promise.all(jobs)).filter(r => r && r.metas.length);
  S.loading = false; if (S.tab === 'home') homeBody();
}
let searchSeq = 0;
async function runSearch() {
  const q = S.q.trim(); const seq = ++searchSeq;
  if (!q) { S.searchRows = null; homeBody(); return; }
  S.searching = true; homeBody();
  const jobs = [];
  for (const a of enabled()) for (const c of (a.manifest.catalogs || [])) {
    const canSearch = (c.extra || []).some(e => e.name === 'search') || (c.extraSupported || []).includes('search');
    if (!canSearch) continue;
    jobs.push(getJSON(url(a, 'catalog', c.type, c.id, 'search=' + encodeURIComponent(q))).then(j => ({ addon: a, cat: c, metas: (j.metas || []).filter(m => m && m.id && m.name) })).catch(() => null));
  }
  const res = (await Promise.all(jobs)).filter(r => r && r.metas.length);
  if (seq !== searchSeq) return;
  S.searchRows = res; S.searching = false; homeBody();
}

/* ───────── pantalla: addons ───────── */
function addonsHTML() {
  const list = S.addons.map(a => {
    const m = a.manifest, res = [...new Set((m.resources || []).map(resName))];
    const logo = m.logo ? `<img src="${esc(m.logo)}" alt="" onerror="this.remove()">` : '';
    const sure = S.confirmDel === a.base;
    return `<div class="item"><div class="logo48" style="background:${colorFor(m.name)}">${logo || esc(initials(m.name))}</div>
      <div class="itext"><b>${esc(m.name)} <span style="font-weight:400">v${esc(m.version || '?')}</span></b><span>${esc(m.description || a.base)}</span><div class="res">${res.map(r => `<i>${esc(r)}</i>`).join('')}</div></div>
      <button class="del ${sure ? 'sure' : ''}" data-act="del:${esc(a.base)}" aria-label="Quitar ${esc(m.name)}">${sure ? 'Quitar' : I.trash}</button>
      <button class="switch" role="switch" aria-checked="${a.enabled}" aria-label="Activar ${esc(m.name)}" data-act="toggle:${esc(a.base)}"><i></i></button></div>`;
  }).join('');
  return `<div class="head"><h1>Addons</h1><p>Cada addon aporta catálogos, fuentes de video o subtítulos. Activa solo los que quieras.</p></div>
    <main class="scroll" style="padding-top:12px">
      <div class="addwrap"><label for="addurl">Añadir addon por enlace</label>
        <div class="addrow"><input id="addurl" type="url" inputmode="url" placeholder="https://…/manifest.json" value="${esc(S.addUrl)}" autocomplete="off" autocapitalize="off"><button class="btn" data-act="install" ${S.adding ? 'disabled' : ''}>${S.adding ? '…' : 'Instalar'}</button></div>
        ${S.addErr ? `<p class="err" role="alert">${esc(S.addErr)}</p>` : ''}
        <p class="hint">Acepta la URL del manifest.json o la carpeta que lo contiene. Si el servidor está en tu red local usa la IP del equipo, por ejemplo http://192.168.1.20:7000/manifest.json</p></div>
      <div class="section"><h2>Instalados</h2></div>
      ${S.addons.length ? `<div class="list">${list}</div>` : '<p class="hint" style="padding:0 16px">No hay addons instalados.</p>'}
    </main>`;
}
async function install() {
  const base = normBase(S.addUrl);
  if (!base) return;
  S.adding = true; S.addErr = ''; render();
  try {
    const m = await getJSON(base + '/manifest.json');
    if (!m || !m.id || !m.name) throw new Error('el manifest no tiene «id» o «name»');
    const prev = S.addons.findIndex(a => a.base === base || a.manifest.id === m.id);
    const rec = { base, manifest: m, enabled: true };
    if (prev >= 0) S.addons[prev] = rec; else S.addons.push(rec);
    saveAddons(); S.addUrl = ''; S.rows = null; S.searchRows = null;
    toast('Instalado: ' + m.name);
  } catch (e) {
    S.addErr = 'No se pudo instalar: ' + e.message + '. Revisa el enlace y que el servidor esté encendido.';
  }
  S.adding = false; render();
}

/* ───────── pantalla: biblioteca ───────── */
function libHTML() {
  let body;
  if (S.libTab === 'list') {
    body = S.lib.length ? `<div class="grid3">${S.lib.slice().reverse().map(it => {
      const k = refKey(it); index[k] = it;
      return `<button class="card" data-act="open" data-k="${esc(k)}">${poster(it)}<span class="cname">${esc(it.name)}</span></button>`;
    }).join('')}</div>` : `<div class="empty"><h3>Tu lista está vacía</h3><p>Abre una serie y toca «Guardar» para tenerla aquí.</p></div>`;
  } else {
    const h = Object.values(S.hist).sort((a, b) => b.ts - a.ts);
    body = h.length ? `<div class="list" style="padding-top:16px">${h.map(e => {
      const pct = e.dur ? Math.min(100, Math.round(e.t / e.dur * 100)) : 0;
      return `<button class="hrow" data-act="resume" data-k="${esc(e.key)}">${poster({ name: e.name, poster: e.poster })}<div class="itext" style="flex:1"><b>${esc(e.name)}</b><span>${esc(e.label || '')}</span><div class="prog" style="position:static;margin-top:6px;background:#4A4458"><i style="width:${pct}%"></i></div></div></button>`;
    }).join('')}</div>` : `<div class="empty"><h3>Sin historial</h3><p>Lo que veas aparecerá aquí para retomarlo.</p></div>`;
  }
  return `<div class="head" style="padding-bottom:0"><h1>Biblioteca</h1></div>
    <div class="tabs"><button class="${S.libTab === 'list' ? 'on' : ''}" data-act="libtab:list">Mi lista</button><button class="${S.libTab === 'hist' ? 'on' : ''}" data-act="libtab:hist">Historial</button></div>
    <main class="scroll" style="padding-top:0">${body}</main>`;
}

/* ───────── pantalla: ajustes ───────── */
function settingsHTML() {
  const prof = profiles.active();
  const profSection = prof ? `<div class="set-card" data-act="showprofiles"><div class="set-avatar" style="background:${esc(prof.color)}">${esc(prof.name[0].toUpperCase())}</div><div class="itext"><b>${esc(prof.name)}</b><span>Cambiar perfil</span></div><span class="set-arrow">${I.back}</span></div>` : '';
  const loginInfo = store.get('loginProvider', null);
  const loginBtn = loginInfo ? `<div class="set-card"><div class="set-icon">${I.user}</div><div class="itext"><b>${esc(loginInfo.name || loginInfo.email)}</b><span>${esc(loginInfo.email)}${loginInfo.verified ? '' : ' · <em style="color:var(--gold)">Sin verificar</em>'}</span></div><button class="btn out" style="height:36px;font-size:13px" data-act="logout">Cerrar sesión</button></div>${!loginInfo.verified ? `<div class="set-card" data-act="resendverify" style="cursor:pointer"><div class="set-icon" style="background:var(--gold)"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="0"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></div><div class="itext"><b>Reenviar verificación</b><span>Te enviaremos un correo para verificar tu cuenta</span></div></div><div class="set-card" data-act="checkverify" style="cursor:pointer"><div class="set-icon" style="background:var(--pri)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><div class="itext"><b>Ya verifiqué mi correo</b><span>Toca aquí para actualizar el estado</span></div></div>` : ''}` : `<div class="auth-form"><input id="authname" type="text" placeholder="Nombre" class="auth-input"><input id="authemail" type="email" placeholder="Correo electrónico" class="auth-input"><input id="authpass" type="password" placeholder="Contraseña (mín. 6 caracteres)" class="auth-input"><button class="btn pri" data-act="register" style="width:100%;margin-top:8px">Crear cuenta</button><div style="text-align:center;color:var(--onm);margin:12px 0;font-size:13px">¿Ya tienes cuenta?</div><button class="btn out" data-act="emaillogin" style="width:100%">Iniciar sesión</button></div>`;
  return `<div class="head"><h1>Ajustes</h1></div><main class="scroll" style="padding-top:12px">
    <div class="set-section"><label>Cuenta</label>${profSection}${loginBtn}</div>
    <div class="set-section"><label>Reproducción</label>
      <div class="set-card" data-act="setquality"><div class="itext"><b>Calidad preferida</b><span>${esc(store.get('quality', 'Auto'))}</span></div><span class="set-arrow">${I.back}</span></div>
      <div class="set-card"><div class="itext"><b>Subtítulos automáticos</b><span>Activar subtítulos si están disponibles</span></div><button class="switch" role="switch" aria-checked="${store.get('autoSubs', true)}" data-act="togglesubs"><i></i></button></div>
      <div class="set-card"><div class="itext"><b>Subtítulos en dramas cortos</b><span>Activar subtítulos en series de Narto Drama</span></div><button class="switch" role="switch" aria-checked="${store.get('nartoSubs', false)}" data-act="togglenartosubs"><i></i></button></div></div>
    <div class="set-section"><label>Interfaz</label>
      </div>
    <div class="set-section"><label>Datos</label>
      <div class="set-card" data-act="clearhist"><div class="itext"><b>Borrar historial</b><span>${Object.keys(S.hist).length} elementos</span></div></div>
      <div class="set-card" data-act="clearlib"><div class="itext"><b>Vaciar mi lista</b><span>${S.lib.length} elementos guardados</span></div></div>
      <div class="set-card" data-act="clearall"><div class="itext"><b>Restablecer todo</b><span>Borra perfiles, historial, lista y addons</span></div></div></div>
    <div class="set-section"><label>Info</label>
      <div class="set-card"><div class="itext"><b>Telón</b><span>v1.0 · Todos los derechos reservados</span></div></div></div>
  </main>`;
}

/* ───────── render principal ───────── */
function render() {
  if (S.profileScreen) {
    $('#screen').innerHTML = profileScreenHTML();
    $('#nav').innerHTML = '';
    return;
  }
  const sc = document.querySelector('#screen .scroll');
  const top = sc ? sc.scrollTop : 0;
  const el = $('#screen');
  if (S.tab === 'home') { el.innerHTML = homeHTML(); homeBody(); }
  else if (S.tab === 'addons') el.innerHTML = addonsHTML();
  else if (S.tab === 'settings') el.innerHTML = settingsHTML();
  else el.innerHTML = libHTML();
  const ns = document.querySelector('#screen .scroll'); if (ns && top) ns.scrollTop = top;
  if (store.get('tvMode', false)) { document.body.classList.add('tv'); setTimeout(() => { const f = document.querySelector('#nav button.on,#screen button,#nav button'); if (f) { f.focus(); f.scrollIntoView({ block: 'nearest' }); } }, 50); }
  $('#nav').innerHTML = [['home', 'Inicio', I.home], ['lib', 'Biblioteca', I.lib], ['settings', 'Ajustes', I.gear]]
    .map(([k, l, ic]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab:${k}" ${S.tab === k ? 'aria-current="page"' : ''}><span class="pill">${ic}</span>${l}</button>`).join('');
}
function setTab(t) {
  S.tab = t; S.confirmDel = null; render();
  if (t === 'home' && S.rows === null && S.addons.length && !S.loading) loadHome();
}

/* ───────── detalle de serie ───────── */
const sortVideos = vs => vs.map((v, i) => ({ v, i })).sort((a, b) =>
  ((a.v.season || 0) - (b.v.season || 0)) || ((a.v.episode ?? a.i) - (b.v.episode ?? b.i)) || (a.i - b.i)).map(x => x.v);
const TT_TO_SL = { 'tt0096697': 'los-simpson' };
async function openDetail(ref) {
  // Pre-seed SL slug for known tt IDs
  if (ref.id.startsWith('tt') && TT_TO_SL[ref.id.split(':')[0]]) {
    const imdb = ref.id.split(':')[0];
    SL._slugs['tt:' + imdb] = TT_TO_SL[imdb];
    SL._imdbIds['tt:' + imdb] = imdb;
  }
  S.detail = { ref, loading: true, meta: null, videos: [] }; S.detailSeason = null;
  $('#detail').hidden = false; renderDetail();
  const a = S.addons.find(x => x.base === ref.base);
  let meta = { id: ref.id, type: ref.type, name: ref.name, poster: ref.poster, description: ref.description };
  let warn = '';
  if (a) {
    try {
      const j = await getJSON(url(a, 'meta', ref.type, ref.id));
      if (j && j.meta) meta = { ...meta, ...j.meta };
    } catch (e) { warn = 'No se pudo cargar la ficha completa (' + e.message + ').'; }
  }
  if (!S.detail || S.detail.ref !== ref) return;
  let videos = Array.isArray(meta.videos) ? sortVideos(meta.videos.filter(v => v && v.id)) : [];
  if (!videos.length) videos = [{ id: meta.id, title: meta.name }];
  if (!videos.length) {
    const epMatch = (meta.description || '').match(/(\d+)\s*[Ee]pisodios?/);
    if (epMatch) {
      const count = Math.min(+epMatch[1], 300);
      for (let e = 1; e <= count; e++) videos.push({ id: `${meta.id}:1:${e}`, title: `Episodio ${e}`, season: 1, episode: e });
    }
  }
  S.detail = { ref, loading: false, meta, videos, warn };
  renderDetail();
  // Pre-cache SL slug for Cinemeta (tt) items so streams resolve faster
  if (ref.id.startsWith('tt') && meta.name && !SL._imdbIds['tt:' + ref.id.split(':')[0]]) {
    const imdb = ref.id.split(':')[0];
    (async () => {
      try {
        const queries = [meta.name];
        if (/^The /i.test(meta.name)) queries.push(meta.name.replace(/^The /i, ''));
        for (const q of queries) {
          try {
            const html = await slFetch('/buscar?q=' + encodeURIComponent(q));
            const cards = slParseCards(html);
            if (cards.length) {
              const slug = cards[0]._slug;
              SL._slugs['tt:' + imdb] = slug;
              SL._imdbIds['tt:' + imdb] = imdb;
              return;
            }
          } catch(e) {}
        }
        // Try slug guessing
        const base = meta.name.toLowerCase().replace(/^the\s+/i, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        const pathBase = ref.type === 'movie' ? '/pelicula/' : '/serie/';
        for (const p of ['', 'los-', 'las-', 'el-', 'la-']) {
          try {
            const r = await fetch(SL_BASE + pathBase + p + base, { method: 'HEAD', credentials: 'include' });
            if (r.ok) { SL._slugs['tt:' + imdb] = p + base; SL._imdbIds['tt:' + imdb] = imdb; return; }
          } catch(e) {}
        }
      } catch(e) {}
    })();
  }
}
function epLabel(videos, i) {
  const v = videos[i]; if (!v) return '';
  if (videos.length < 2) return '';
  return 'Ep. ' + (v.episode != null ? v.episode : i + 1);
}
function renderDetail() {
  const d = S.detail, el = $('#detail'); if (!d) { el.hidden = true; el.innerHTML = ''; return; }
  const m = d.meta || d.ref, bg = m.background || m.poster;
  const saved = S.lib.some(x => refKey(x) === refKey(d.ref));
  const h = S.hist[refKey(d.ref)];
  let body = '';
  if (d.loading) body = '<div class="spin" role="progressbar" aria-label="Cargando"></div>';
  else {
    const cur = h ? Math.min(h.idx, d.videos.length - 1) : 0;
    const pills = [countryOf(m), ...(m.genres || []).slice(0, 3), m.releaseInfo || m.year, d.videos.length > 1 ? d.videos.length + ' episodios' : ''].filter(Boolean);
    body = `${pills.length ? `<div class="pills">${pills.map(p => `<i>${esc(p)}</i>`).join('')}</div>` : ''}
      ${m.description ? `<p class="desc">${esc(m.description)}</p>` : ''}
      ${d.warn ? `<p class="err">${esc(d.warn)}</p>` : ''}
      <div class="actions"><button class="btn" data-act="play:${cur}">${h && h.t > 1 ? 'Continuar ' + esc(epLabel(d.videos, cur)) : 'Reproducir'}</button>
      <button class="btn out" data-act="savelib">${saved ? 'Guardado' : 'Guardar'}</button></div>
      ${d.videos.length > 1 ? (() => {
        const seasons = [...new Set(d.videos.map(v => v.season != null ? v.season : 1))].sort((a, b) => a - b);
        const sel = S.detailSeason != null ? S.detailSeason : seasons[0];
        const seasonChips = seasons.length > 1 ? `<div class="season-chips">${seasons.map(s => `<button class="chip${s === sel ? ' on' : ''}" data-act="season:${s}">${s === 0 ? 'Especiales' : 'Temporada ' + s}</button>`).join('')}</div>` : '';
        const filtered = d.videos.map((v, i) => ({ v, i })).filter(x => (x.v.season != null ? x.v.season : 1) === sel);
        return `<h3 style="font-size:18px;font-weight:500">Episodios</h3>${seasonChips}<div class="eps">${filtered.map(({ v, i }) =>
          `<button class="ep ${h && h.idx === i ? 'seen' : ''}" data-act="play:${i}" aria-label="Episodio ${esc(v.episode != null ? v.episode : i + 1)}">${esc(v.episode != null ? v.episode : i + 1)}</button>`).join('')}</div>`;
      })() : ''}`;
  }
  el.innerHTML = `<div class="dhero" style="background-color:${colorFor(m.name)};${bg ? `background-image:url('${esc(bg)}')` : ''}"><button class="iconbtn" data-act="closedetail" aria-label="Volver">${I.back}</button></div>
    <div class="dbody"><h1>${esc(m.name)}</h1>${body}</div>`;
}
function closeDetail() { S.detail = null; $('#detail').hidden = true; $('#detail').innerHTML = ''; }
function toggleLib(ref) {
  const k = refKey(ref), i = S.lib.findIndex(x => refKey(x) === k);
  if (i >= 0) { S.lib.splice(i, 1); toast('Quitado de tu lista'); }
  else { S.lib.push({ base: ref.base, type: ref.type, id: ref.id, name: (S.detail && S.detail.meta && S.detail.meta.name) || ref.name, poster: (S.detail && S.detail.meta && S.detail.meta.poster) || ref.poster, country: ref.country }); toast('Guardado en tu lista'); }
  saveLib();
}

/* ───────── reproductor vertical ───────── */
function resolveStreams(type, videoId, onFirst) {
  const addons = enabled().filter(a => resOk(a, 'stream', type, videoId));
  const all = []; let fired = false;
  const jobs = addons.map(a => getJSON(url(a, 'stream', type, videoId), 60000)
    .then(j => {
      const s = (j.streams || []).filter(s => s && s.url).map(s => ({ ...s, addon: a }));
      all.push(...s);
      if (s.length && !fired && onFirst) { fired = true; onFirst(all.slice()); }
      return s;
    }).catch(() => []));
  return Promise.all(jobs).then(() => all);
}
async function resolveSubs(type, videoId, streams) {
  const out = [];
  streams.forEach(s => (s.subtitles || []).forEach(x => x && x.url && out.push(x)));
  const jobs = enabled().filter(a => resOk(a, 'subtitles', type, videoId))
    .map(a => getJSON(url(a, 'subtitles', type, videoId)).then(j => j.subtitles || []).catch(() => []));
  (await Promise.all(jobs)).flat().forEach(x => x && x.url && out.push(x));
  const es = out.find(x => /^(es|spa)/i.test(x.lang || ''));
  return es || out[0] || null;
}
async function subBlob(u) {
  let t = await (await fetch(u)).text();
  if (!/^﻿?WEBVTT/.test(t)) t = 'WEBVTT\n\n' + t.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return URL.createObjectURL(new Blob([t], { type: 'text/vtt' }));
}

function openPlayer(ref, meta, videos, idx) {
  const isHoriz = ref.base !== '__nartodrama__' && !ref.base.includes('/narto');
  const isNarto0 = ref.base === '__nartodrama__' || (ref.base || '').includes('/narto');
  const subsInit = isNarto0 ? store.get('nartoSubs', false) : store.get('autoSubs', true);
  const P = S.player = { ref, meta, videos, idx, key: refKey(ref), streams: [], si: 0, token: 0, muted: false, speed: 1, subsOn: subsInit, subLine: store.get('subLine', -4), subSize: store.get('subSize', 20), resumeAt: 0, lastSave: 0, sheet: null, swiped: false, state: 'loading', horiz: isHoriz };
  try { TelonBridge.setOrientation(isHoriz ? 'landscape' : 'portrait'); } catch(e) {}
  const el = $('#player'); el.hidden = false;
  el.innerHTML = `<div class="stage" data-p="tap"><video playsinline webkit-playsinline preload="auto"></video></div><div class="shade"></div>
    <button class="pbtn" data-p="back" aria-label="Cerrar reproductor">${I.back}</button>
    <button class="srcchip" data-p="sources" aria-label="Cambiar fuente"><i></i><span id="psrc">Buscando fuente…</span></button>
    <div class="rail" id="prail"></div>
    <div class="center" id="pcenter"></div>
    <div class="pinfo"><h2 id="ptitle"></h2><span id="pep"></span></div>
    <div class="pbar" id="pbar"><i id="pfill"></i></div>
    <div id="psheet"></div>`;
  const v = P.video = el.querySelector('video');
  v.addEventListener('playing', () => { setCenter(''); clearTimeout(P._hideT); P._hideT = setTimeout(() => $('#player').classList.add('hide-ui'), 2000); });
  v.addEventListener('waiting', () => { if (!v.paused) setCenter('loading'); });
  v.addEventListener('pause', () => { if (!v.ended && P.state === 'ok') { setCenter('paused'); $('#player').classList.remove('hide-ui'); clearTimeout(P._hideT); } });
  v.addEventListener('loadedmetadata', () => {
    v.classList.toggle('contain', v.videoWidth >= v.videoHeight);
    if (P.resumeAt > 1 && P.resumeAt < v.duration - 5) v.currentTime = P.resumeAt;
    P.resumeAt = 0;
    function _autoSubs() { if (!P.subsOn) return; for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = 'showing'; _applyCueStyle(P); }
    _autoSubs();
    for (let t = 1; t <= 10; t++) setTimeout(_autoSubs, t * 1000);
    _applyCueStyle(P);
  });
  v.textTracks.addEventListener('addtrack', e => {
    if (!S.player) return;
    if (S.player.subsOn && e.track) e.track.mode = 'showing';
    if (e.track) {
      const ln = S.player.subLine || -4;
      e.track.addEventListener('cuechange', function() {
        if (!e.track.activeCues) return;
        for (let i = 0; i < e.track.activeCues.length; i++) { try { e.track.activeCues[i].line = S.player ? S.player.subLine : ln; } catch(x) {} }
      });
    }
  });
  v.addEventListener('timeupdate', () => {
    if (v.duration) $('#pfill').style.width = (v.currentTime / v.duration * 100) + '%';
    const now = Date.now();
    if (now - P.lastSave > 3000 && v.currentTime > 0) { P.lastSave = now; persist(); }
  });
  v.addEventListener('ended', () => { persist(true); if (P.idx < P.videos.length - 1) { setCenter('transition'); go(1); } else setCenter('paused'); });
  v.addEventListener('error', () => {
    if (!v.getAttribute('src')) return;
    if (P.si < P.streams.length - 1) { P.si++; playStream(); toast('Probando otra fuente…'); }
    else setCenter('error', 'No se pudo reproducir este episodio. Prueba con otra fuente o revisa el addon.');
  });
  // deslizar para cambiar de episodio
  let y0 = null, x0 = 0;
  const stage = el.querySelector('.stage');
  stage.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0, dx = e.changedTouches[0].clientX - x0; y0 = null;
    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      P.swiped = true; setTimeout(() => { P.swiped = false; }, 400);
      go(dy < 0 ? 1 : -1);
    }
  }, { passive: true });
  loadVideo(idx);
}
function go(dir) {
  const P = S.player; if (!P) return;
  const n = P.idx + dir;
  if (n < 0 || n >= P.videos.length) { toast(dir > 0 ? 'Es el último episodio' : 'Es el primer episodio'); return; }
  persist(true);
  P.video.classList.add(dir > 0 ? 'out-up' : 'out-down');
  setTimeout(() => { if (S.player === P) { P.video.classList.remove('out-up', 'out-down'); loadVideo(n); } }, 220);
}
function persist(force) {
  const P = S.player; if (!P || !P.video) return;
  const v = P.video, t = v.currentTime || 0, dur = v.duration || 0;
  if (!force && t < 1) return;
  S.hist[P.key] = { key: P.key, base: P.ref.base, type: P.ref.type, id: P.ref.id, name: P.meta.name, poster: P.meta.poster,
    idx: P.idx, videoId: P.videos[P.idx].id, label: epLabel(P.videos, P.idx), total: P.videos.length, t: dur && t > dur - 3 ? 0 : t, dur, ts: Date.now() };
  saveHist();
}
async function loadVideo(i) {
  const P = S.player; if (!P) return;
  P.idx = i; P.streams = []; P.si = 0; P.state = 'loading';
  const token = ++P.token, v = P.video, vid = P.videos[i];
  v.pause(); v.removeAttribute('src'); v.style.display = ''; v.querySelectorAll('track').forEach(t => t.remove()); v.load();
  const oldEmbed = $('#player .embed-frame'); if (oldEmbed) oldEmbed.remove();
  $('#pfill').style.width = '0';
  const h = S.hist[P.key];
  P.resumeAt = h && h.idx === i && h.videoId === vid.id ? h.t : 0;
  updatePlayerUI(); setCenter('loading');
  let started = false;
  const onFirst = (streams) => {
    if (token !== P.token || started) return;
    started = true;
    P.streams = streams; P.si = 0;
    playStream();
  };
  resolveSubs(P.ref.type, vid.id, []).then(async sub => {
    if (!sub || token !== P.token) return;
    try {
      const tr = document.createElement('track');
      tr.kind = 'subtitles'; tr.label = sub.lang || 'Subtítulos'; tr.srclang = (sub.lang || 'es').slice(0, 2); tr.default = true;
      tr.src = await subBlob(sub.url);
      if (token !== P.token) return;
      v.appendChild(tr); tr.track.mode = 'showing';
    } catch (e) { /* sin subtítulos */ }
  });
  const allStreams = await resolveStreams(P.ref.type, vid.id, onFirst);
  if (token !== P.token) return;
  if (!allStreams.length) { P.state = 'error'; setCenter('error', 'Ningún addon activo ofrece una fuente para este episodio.'); updatePlayerUI(); return; }
  P.streams = allStreams; updatePlayerUI();
}
function playStream() {
  const P = S.player; if (!P) return;
  const s = P.streams[P.si]; P.state = 'ok';
  const el = $('#player');
  const oldIframe = el.querySelector('.embed-frame');
  if (oldIframe) oldIframe.remove();
  if (s._type === 'embed') {
    P.video.style.display = 'none';
    P._embedActive = true;
    window._embedOpened = () => { if (S.player === P) setCenter(''); };
    window._embedClosed = () => { if (S.player === P) { P._embedActive = false; closePlayer(); } };
    window._embedVideoFound = (videoUrl) => {
      if (S.player !== P) return;
      P._embedActive = false;
      P.video.style.display = '';
      P.video.src = videoUrl; P.video.muted = P.muted; P.video.playbackRate = P.speed;
      P.state = 'ok'; setCenter(''); updatePlayerUI();
    };
    try { TelonBridge.openEmbed(s.url, 'https://sololatino.net'); } catch(e) { setCenter('error', 'No se pudo cargar el reproductor.'); }
    return;
  } else {
    P.video.style.display = '';
    P.video.src = s.url; P.video.muted = P.muted; P.video.playbackRate = P.speed;
    P.video.play().catch(() => setCenter('paused'));
  }
  updatePlayerUI();
}
function setCenter(kind, msg) {
  const c = $('#pcenter'); if (!c) return;
  if (kind === 'transition') { const P = S.player; const img = P && P.meta && P.meta.poster ? `<img src="${esc(P.meta.poster)}" style="width:120px;border-radius:12px;margin-bottom:12px" alt="">` : ''; c.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">${img}<div class="spin" style="margin-bottom:8px"></div><span style="color:#fff;font-size:15px">Cargando siguiente capítulo…</span></div>`; return; }
  if (kind === 'loading') { const P = S.player; const img = P && P.meta && P.meta.poster ? `<img src="${esc(P.meta.poster)}" style="width:120px;border-radius:12px;margin-bottom:12px" alt="">` : ''; c.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">${img}<div class="spin" style="margin-bottom:8px"></div><span style="color:#fff;font-size:15px">Cargando capítulo…</span></div>`; }
  else if (kind === 'paused') c.innerHTML = `<span class="bubble">${I.playBig}</span>`;
  else if (kind === 'error') c.innerHTML = `<div class="msg" role="alert">${esc(msg)}</div><div style="display:flex;gap:8px"><button class="btn" data-p="retry">Reintentar</button><button class="btn out" style="background:#000000aa" data-p="sources">Fuentes</button></div>`;
  else c.innerHTML = '';
}
let _subFlashT;
function _subFlash(value, label) {
  let el = document.getElementById('_subFlash');
  if (!el) { el = document.createElement('div'); el.id = '_subFlash'; document.body.appendChild(el); }
  el.innerHTML = `<span style="font-size:32px;font-weight:700">${value}</span><span style="font-size:13px;color:#aaa">${label}</span>`;
  el.style.cssText = 'position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);z-index:200;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:16px 28px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;pointer-events:none;animation:_sfIn .35s ease';
  clearTimeout(_subFlashT);
  _subFlashT = setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => { el.remove(); }, 300); }, 600);
}
function _applyCueStyle(P) {
  const v = P.video; if (!v) return;
  for (let t = 0; t < v.textTracks.length; t++) {
    const track = v.textTracks[t]; if (!track.cues) continue;
    for (let c = 0; c < track.cues.length; c++) { try { track.cues[c].line = P.subLine; } catch(e) {} }
  }
  const st = document.getElementById('_subStyle');
  const css = `#player video::cue{font-size:${P.subSize}px!important;line-height:${P.subSize + 8}px!important}`;
  if (st) st.textContent = css; else { const s = document.createElement('style'); s.id = '_subStyle'; s.textContent = css; document.head.appendChild(s); }
}
function updatePlayerUI() {
  const P = S.player; if (!P) return;
  const v = P.videos[P.idx], s = P.streams[P.si];
  $('#ptitle').textContent = P.meta.name;
  const lab = epLabel(P.videos, P.idx), extra = v.title && v.title !== P.meta.name ? v.title : '';
  $('#pep').textContent = [lab && lab + ' de ' + P.videos.length, extra].filter(Boolean).join(' · ');
  $('#psrc').textContent = s ? `${s.addon.manifest.name}${s.name || s.title ? ' · ' + (s.name || s.title).split('\n')[0] : ''}` : (P.state === 'error' ? 'Sin fuente' : 'Buscando fuente…');
  const saved = S.lib.some(x => refKey(x) === P.key);
  $('#prail').innerHTML =
    `<button data-p="save" class="${saved ? 'on' : ''}" aria-label="Guardar en mi lista">${saved ? I.saveOn : I.save}Guardar</button>` +
    (P.videos.length > 1 ? `<button data-p="eps" aria-label="Lista de episodios">${I.eps}Episodios</button>` : '') +
    (P.streams.length > 1 ? `<button data-p="sources" aria-label="Fuentes">${I.layers}Fuentes</button>` : '') +
    `<button data-p="subs" class="${P.subsOn ? 'on' : ''}" aria-label="Subtítulos">${P.subsOn ? I.subs : I.subsOff}Subs</button>` +
    `<button data-p="mute" aria-label="${P.muted ? 'Activar sonido' : 'Silenciar'}">${P.muted ? I.mute : I.vol}${P.muted ? 'Mute' : 'Sonido'}</button>` +
    `<button data-p="speed" aria-label="Velocidad">${I.speed}${P.speed === 1 ? '1x' : P.speed + 'x'}</button>`;
}
function playerSheet(kind) {
  const P = S.player, box = $('#psheet'); P.sheet = kind;
  if (!kind) { box.innerHTML = ''; return; }
  let inner;
  if (kind === 'eps') {
    const seasons = [...new Set(P.videos.map(v => v.season != null ? v.season : 1))].sort((a, b) => a - b);
    const curSeason = P.videos[P.idx] ? (P.videos[P.idx].season != null ? P.videos[P.idx].season : 1) : seasons[0];
    const sel = S.playerSeason != null ? S.playerSeason : curSeason;
    const seasonChips = seasons.length > 1 ? `<div class="season-chips">${seasons.map(s => `<button class="chip${s === sel ? ' on' : ''}" data-p="pseason:${s}">${s === 0 ? 'Esp' : 'T' + s}</button>`).join('')}</div>` : '';
    const filtered = P.videos.map((v, i) => ({ v, i })).filter(x => (x.v.season != null ? x.v.season : 1) === sel);
    inner = `<div class="sh"><h3>Episodios</h3><button class="iconbtn" data-p="closesheet" aria-label="Cerrar">${I.close}</button></div>${seasonChips}
      <div class="eps">${filtered.map(({ v, i }) => `<button class="ep ${i === P.idx ? 'cur' : ''}" data-p="ep:${i}" aria-label="Episodio ${esc(v.episode != null ? v.episode : i + 1)}">${esc(v.episode != null ? v.episode : i + 1)}</button>`).join('')}</div>`;
  } else if (kind === 'subs') {
    const pos = P.subLine || -4, sz = P.subSize || 20;
    inner = `<div class="sh"><h3>Subtítulos</h3><button class="iconbtn" data-p="closesheet" aria-label="Cerrar">${I.close}</button></div>
      <div class="set-card" style="background:var(--surf2);border:1px solid var(--outline);border-radius:10px;padding:14px"><div class="itext"><b style="color:#fff">Activados</b></div><button class="switch" role="switch" aria-checked="${P.subsOn}" data-p="subtoggle"><i></i></button></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0"><span style="font-size:14px;color:#ccc">Posición</span><div style="display:flex;gap:8px"><button class="chip" data-p="subpos:-1" aria-label="Subir">▲ Arriba</button><button class="chip" data-p="subpos:1" aria-label="Bajar">▼ Abajo</button></div></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0"><span style="font-size:14px;color:#ccc">Tamaño (${sz}px)</span><div style="display:flex;gap:8px"><button class="chip" data-p="subsize:-2" aria-label="Menor">A−</button><button class="chip" data-p="subsize:2" aria-label="Mayor">A+</button></div></div>`;
  } else {
    inner = `<div class="sh"><h3>Fuentes</h3><button class="iconbtn" data-p="closesheet" aria-label="Cerrar">${I.close}</button></div>` +
      (P.streams.length ? P.streams.map((s, i) => `<button class="srcopt ${i === P.si ? 'on' : ''}" data-p="src:${i}">${esc(s.addon.manifest.name)}<span>${esc(((s.name || '') + ' ' + (s.title || '')).trim().split('\n')[0] || 'Fuente ' + (i + 1))}</span></button>`).join('')
        : '<p class="desc">Ningún addon activo ofrece fuentes para este episodio.</p>');
  }
  box.innerHTML = `<div class="sheetbg" data-p="closesheet"><div class="sheet" data-p="keep"><div class="grab"></div>${inner}</div></div>`;
}
function closePlayer() {
  const P = S.player; if (!P) return;
  try { TelonBridge.setOrientation(store.get('tvMode', false) ? 'landscape' : 'portrait'); } catch(e) {}
  try { TelonBridge.closeEmbed(); } catch(e) {}
  persist(true); P.token++;
  P.video.pause(); P.video.removeAttribute('src'); P.video.load();
  S.player = null; const el = $('#player'); el.hidden = true; el.innerHTML = '';
  if (S.detail) renderDetail();
  if (S.tab === 'home') homeBody(); else if (S.tab === 'lib') render();
}
function playerClick(e) {
  const P = S.player; if (!P) return;
  const b = e.target.closest('[data-p]'); if (!b) return;
  const [a, arg] = b.dataset.p.split(':');
  if (a === 'keep') return;
  if (a === 'tap') {
    if (P.swiped || P.sheet) return;
    const el = $('#player');
    if (el.classList.contains('hide-ui')) {
      el.classList.remove('hide-ui');
      clearTimeout(P._hideT); P._hideT = setTimeout(() => { if (S.player && !S.player.video.paused) $('#player').classList.add('hide-ui'); }, 3000);
    } else {
      if (P.video.paused) P.video.play().catch(() => {}); else P.video.pause();
    }
    return;
  }
  else if (a === 'back') closePlayer();
  else if (a === 'subs') playerSheet('subs');
  else if (a === 'subtoggle') { P.subsOn = !P.subsOn; for (let i = 0; i < P.video.textTracks.length; i++) P.video.textTracks[i].mode = P.subsOn ? 'showing' : 'disabled'; updatePlayerUI(); playerSheet('subs'); }
  else if (a === 'subpos') { P.subLine = Math.max(-12, Math.min(-1, (P.subLine || -4) + (+arg))); store.set('subLine', P.subLine); _applyCueStyle(P); _subFlash(+arg < 0 ? '▲' : '▼', 'Posición'); playerSheet('subs'); }
  else if (a === 'subsize') { P.subSize = Math.max(12, Math.min(36, (P.subSize || 20) + (+arg))); store.set('subSize', P.subSize); _applyCueStyle(P); _subFlash(P.subSize + 'px', 'Tamaño'); playerSheet('subs'); }
  else if (a === 'mute') { P.muted = !P.muted; P.video.muted = P.muted; updatePlayerUI(); }
  else if (a === 'save') { toggleLib(P.ref); updatePlayerUI(); }
  else if (a === 'eps') playerSheet('eps');
  else if (a === 'sources') playerSheet('src');
  else if (a === 'closesheet') playerSheet(null);
  else if (a === 'pseason') { S.playerSeason = +arg; playerSheet('eps'); }
  else if (a === 'ep') { playerSheet(null); if (+arg !== P.idx) { persist(true); loadVideo(+arg); } }
  else if (a === 'src') { playerSheet(null); P.si = +arg; const t = P.video.currentTime; P.resumeAt = t; playStream(); }
  else if (a === 'speed') { const speeds = [1, 1.5, 1.8, 2]; P.speed = speeds[(speeds.indexOf(P.speed) + 1) % speeds.length]; P.video.playbackRate = P.speed; updatePlayerUI(); }
  else if (a === 'retry') loadVideo(P.idx);
}

/* ───────── eventos globales ───────── */
document.addEventListener('click', e => {
  if (e.target.closest('#player')) return;
  const b = e.target.closest('[data-act]'); if (!b) return;
  const [a, ...r] = b.dataset.act.split(':'), arg = r.join(':');
  if (a === 'tab') { if ($('#detail') && !$('#detail').hidden) closeDetail(); setTab(arg); }
  else if (a === 'filter') { S.filter = arg; homeBody(); }
  else if (a === 'ftype') { S.filterType = S.filterType === arg ? 'all' : arg; homeBody(); }
  else if (a === 'fgenre') { S.filterGenre = S.filterGenre === arg ? 'all' : arg; homeBody(); }
  else if (a === 'filterreset') { S.filter = 'all'; S.filterType = 'all'; S.filterGenre = 'all'; homeBody(); }
  else if (a === 'pickprofile') { profiles.setActive(arg); S.profileScreen = false; render(); if (!S.rows && S.addons.length) loadHome(); }
  else if (a === 'addprofile') {
    const name = prompt('Nombre del perfil:'); if (!name || !name.trim()) return;
    const color = PROFILE_COLORS[profiles.all().length % PROFILE_COLORS.length];
    const p = profiles.add(name.trim(), color);
    if (profiles.all().length === 1) profiles.setActive(p.id);
    render();
  }
  else if (a === 'showprofiles') { S.profileScreen = true; render(); }
  else if (a === 'editprofileimg') {
    const prof = profiles.active();
    if (!prof) { toast('Selecciona un perfil primero'); return; }
    const choice = prompt('Escribe la URL de una imagen, o escribe "galería" para elegir una foto del teléfono:');
    if (!choice) return;
    if (choice.trim().toLowerCase() === 'galería' || choice.trim().toLowerCase() === 'galeria') {
      const input = document.getElementById('pffile');
      if (input) {
        input.onchange = (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => { profiles.update(prof.id, { image: reader.result }); render(); toast('Foto actualizada'); };
          reader.readAsDataURL(file);
          input.value = '';
        };
        input.click();
      }
    } else if (choice.trim().startsWith('http')) {
      profiles.update(prof.id, { image: choice.trim() });
      render(); toast('Foto actualizada');
    } else { toast('URL no válida'); }
  }
  else if (a === 'manageprofiles') {
    const list = profiles.all();
    const names = list.map(p => p.name).join(', ');
    const del = prompt('Escribe el nombre del perfil a eliminar:\n(' + names + ')');
    if (!del) return;
    const found = list.find(p => p.name.toLowerCase() === del.trim().toLowerCase());
    if (found) { profiles.remove(found.id); toast('Perfil eliminado'); render(); }
    else toast('Perfil no encontrado');
  }
  else if (a === 'refresh') { S.rows = null; loadHome(); }
  else if (a === 'reloadaddons') reloadAddons();
  else if (a === 'search') { S.searchOpen = !S.searchOpen; if (!S.searchOpen) { S.q = ''; S.searchRows = null; } render(); if (S.searchOpen) $('#q').focus(); }
  else if (a === 'open') { const ref = index[b.dataset.k]; if (ref) openDetail(ref); }
  else if (a === 'closedetail') closeDetail();
  else if (a === 'season') { S.detailSeason = +arg; renderDetail(); }
  else if (a === 'savelib') { toggleLib(S.detail.ref); renderDetail(); }
  else if (a === 'play') { const d = S.detail; if (d && !d.loading) openPlayer(d.ref, d.meta, d.videos, +arg); }
  else if (a === 'resume') resume(b.dataset.k);
  else if (a === 'libtab') { S.libTab = arg; render(); }
  else if (a === 'install') install();
  else if (a === 'toggle') { const x = S.addons.find(y => y.base === arg); if (x) { x.enabled = !x.enabled; saveAddons(); S.rows = null; S.searchRows = null; render(); } }
  else if (a === 'del') {
    if (S.confirmDel === arg) { S.addons = S.addons.filter(y => y.base !== arg); saveAddons(); S.rows = null; S.confirmDel = null; toast('Addon quitado'); }
    else S.confirmDel = arg;
    render();
  }
  else if (a === 'togglesubs') { store.set('autoSubs', !store.get('autoSubs', true)); render(); }
  else if (a === 'togglenartosubs') { store.set('nartoSubs', !store.get('nartoSubs', false)); render(); }
  else if (a === 'toggletv') { store.set('tvMode', !store.get('tvMode', false)); render(); }
  else if (a === 'changedevice') { store.set('deviceChosen', false); location.reload(); }
  else if (a === 'setquality') {
    const opts = ['Auto', '1080p', '720p', '480p'];
    const cur = store.get('quality', 'Auto');
    const next = opts[(opts.indexOf(cur) + 1) % opts.length];
    store.set('quality', next); toast('Calidad: ' + next); render();
  }
  else if (a === 'clearhist') { if (confirm('¿Borrar todo el historial?')) { S.hist = {}; saveHist(); toast('Historial borrado'); render(); } }
  else if (a === 'clearlib') { if (confirm('¿Vaciar tu lista?')) { S.lib = []; saveLib(); toast('Lista vaciada'); render(); } }
  else if (a === 'clearall') { if (confirm('¿Restablecer todo? Se borran perfiles, historial, lista y addons.')) { localStorage.clear(); location.reload(); } }
  else if (a === 'register') {
    const name = (document.getElementById('authname') || {}).value || '';
    const email = (document.getElementById('authemail') || {}).value || '';
    const pass = (document.getElementById('authpass') || {}).value || '';
    if (!name.trim()) { toast('Escribe tu nombre'); return; }
    if (!email.trim()) { toast('Escribe tu correo'); return; }
    if (pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres'); return; }
    toast('Creando cuenta…');
    firebase.auth().createUserWithEmailAndPassword(email, pass).then(cred => {
      cred.user.updateProfile({ displayName: name.trim() }).catch(() => {});
      cred.user.sendEmailVerification().catch(() => {});
      store.set('loginProvider', { provider: 'email', name: name.trim(), email: cred.user.email, verified: false, idToken: cred.user._idToken });
      toast('Cuenta creada. Revisa tu correo para verificar.');
      render();
    }).catch(err => {
      const msgs = { 'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Inicia sesión.', 'auth/invalid-email': 'Correo no válido.', 'auth/weak-password': 'Contraseña muy débil.', 'EMAIL_EXISTS': 'Ese correo ya tiene cuenta. Inicia sesión.', 'INVALID_EMAIL': 'Correo no válido.', 'WEAK_PASSWORD': 'Contraseña muy débil (mín. 6 caracteres).', 'OPERATION_NOT_ALLOWED': 'Registro deshabilitado.' };
      toast(msgs[err.code] || err.message || 'Error al crear cuenta');
    });
  }
  else if (a === 'emaillogin') {
    const email = (document.getElementById('authemail') || {}).value || '';
    const pass = (document.getElementById('authpass') || {}).value || '';
    if (!email.trim() || !pass) { toast('Escribe correo y contraseña'); return; }
    toast('Iniciando sesión…');
    firebase.auth().signInWithEmailAndPassword(email, pass).then(cred => {
      const u = cred.user;
      store.set('loginProvider', { provider: 'email', name: u.displayName || email.split('@')[0], email: u.email, verified: u.emailVerified, idToken: u._idToken });
      toast('Sesión iniciada como ' + (u.displayName || u.email));
      render();
    }).catch(err => {
      const msgs = { 'auth/user-not-found': 'No hay cuenta con ese correo.', 'auth/wrong-password': 'Contraseña incorrecta.', 'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'EMAIL_NOT_FOUND': 'No hay cuenta con ese correo.', 'INVALID_PASSWORD': 'Contraseña incorrecta.', 'INVALID_LOGIN_CREDENTIALS': 'Correo o contraseña incorrectos.', 'USER_DISABLED': 'Cuenta deshabilitada.' };
      toast(msgs[err.code] || err.message || 'Error al iniciar sesión');
    });
  }
  else if (a === 'resendverify') {
    const u = firebase.auth().currentUser;
    if (u) { u.sendEmailVerification().then(() => toast('Correo de verificación enviado')).catch(() => toast('Espera un momento antes de reenviar')); }
  }
  else if (a === 'checkverify') {
    const lp = store.get('loginProvider', null);
    if (lp && lp.idToken) {
      toast('Comprobando…');
      _fbPost('lookup', { idToken: lp.idToken }).then(j => {
        if (j.users && j.users[0]) {
          const v = j.users[0].emailVerified || false;
          lp.verified = v;
          store.set('loginProvider', lp);
          if (v) { toast('¡Tu correo está verificado!'); } else { toast('Aún no verificado. Revisa tu correo.'); }
          render();
        }
      }).catch(() => toast('No se pudo comprobar. Intenta iniciar sesión de nuevo.'));
    }
  }
  else if (a === 'logout') { firebase.auth().signOut(); store.set('loginProvider', null); toast('Sesión cerrada'); render(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'addurl') S.addUrl = e.target.value;
  if (e.target.id === 'q') { S.q = e.target.value; clearTimeout(S._qt); S._qt = setTimeout(runSearch, 350); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'addurl') install();
});
$('#player').addEventListener('click', playerClick);

async function resume(key) {
  const h = S.hist[key]; if (!h) return;
  const a = S.addons.find(x => x.base === h.base);
  if (!a) { toast('El addon de esta serie ya no está instalado'); return; }
  const ref = { base: h.base, type: h.type, id: h.id, name: h.name, poster: h.poster };
  toast('Cargando…');
  let meta = { id: h.id, type: h.type, name: h.name, poster: h.poster };
  try { const j = await getJSON(url(a, 'meta', h.type, h.id)); if (j && j.meta) meta = { ...meta, ...j.meta }; } catch (e) { /* usa lo guardado */ }
  let videos = Array.isArray(meta.videos) ? sortVideos(meta.videos.filter(v => v && v.id)) : [];
  if (!videos.length) videos = [{ id: meta.id, title: meta.name }];
  const idx = Math.max(0, Math.min(h.idx, videos.length - 1));
  S.detail = { ref, loading: false, meta, videos }; $('#detail').hidden = false; renderDetail();
  openPlayer(ref, meta, videos, idx);
}

/* botón «atrás» de Android (lo llama MainActivity) */
window.telonBack = () => {
  if (S.profileScreen && profiles.active()) { S.profileScreen = false; render(); return true; }
  if (S.player) { if (S.player.sheet) playerSheet(null); else closePlayer(); return true; }
  if (S.detail) { closeDetail(); return true; }
  if (S.searchOpen) { S.searchOpen = false; S.q = ''; S.searchRows = null; render(); return true; }
  if (S.tab !== 'home') { setTab('home'); return true; }
  return false;
};
window.telonPause = () => { if (S.player) { S.player.video.pause(); persist(true); } };
window.__telon = S; // depuración

/* ───────── addon virtual: Narto Drama (narto-drama.com/AnyReel) ───────── */
const ND = {
  base: '__nartodrama__',
  manifest: {
    id: 'app.telon.nartodrama', version: '1.0.0', name: 'Narto Drama',
    description: 'Dramas cortos desde narto-drama.com (AnyReel)',
    resources: ['catalog', 'meta', 'stream'], types: ['series'], idPrefixes: ['nd-'],
    catalogs: [{ type: 'series', id: 'nd-tendencia', name: 'Tendencia', extra: [{ name: 'search' }] }],
  },
  enabled: true,
  _cache: {}, _slugs: {},
};

async function ndFetchText(path) {
  const r = await fetch('https://narto-drama.com' + path, { headers: { 'Accept-Language': 'es-419,es' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

async function ndSections() {
  if (ND._cache.sections && Date.now() - ND._cache.sectionsTs < 600000) return ND._cache.sections;
  const raw = await ndFetchText('/home/providers/sections?provider=anyreel&lang=es-ES&target_lang=es-ES');
  const data = JSON.parse(raw);
  if (!data.ok || !data.sections) return [];
  const items = [], seen = new Set();
  for (const sec of data.sections) for (const it of (sec.items || [])) {
    const bid = (it.watch_url || '').match(/book_id=(\d+)/);
    if (!bid || seen.has(bid[1])) continue;
    seen.add(bid[1]);
    const watchUrl = it.watch_url.startsWith('http') ? it.watch_url : 'https://narto-drama.com' + it.watch_url;
    items.push({
      id: 'nd-' + bid[1], type: 'series', name: it.title || 'Drama',
      poster: it.poster_url || '', description: it.description || '',
      genres: it.tag_names || [], _bookId: bid[1], _watchUrl: watchUrl,
    });
  }
  ND._cache.sections = items; ND._cache.sectionsTs = Date.now();
  return items;
}

async function ndResolveSlug(bookId) {
  if (ND._slugs[bookId]) return ND._slugs[bookId];
  const items = await ndSections();
  const it = items.find(x => x._bookId === bookId);
  if (!it) return null;
  // Follow the redirect to get the slug
  const r = await fetch(it._watchUrl, { redirect: 'follow', headers: { 'Accept-Language': 'es-419,es' } });
  const finalUrl = r.url;
  const m = finalUrl.match(/\/detail\/watch\/([^/?]+)/);
  if (m) { ND._slugs[bookId] = m[1]; return m[1]; }
  // If HTML, try to find it in the body
  const html = await r.text();
  const m2 = html.match(/\/detail\/watch\/([a-z0-9-]+)/);
  if (m2) { ND._slugs[bookId] = m2[1]; return m2[1]; }
  return null;
}

async function ndMeta(bookId) {
  const ck = 'meta:' + bookId;
  if (ND._cache[ck] && Date.now() - ND._cache[ck].ts < 600000) return ND._cache[ck].val;
  const slug = await ndResolveSlug(bookId);
  if (!slug) return { id: 'nd-' + bookId, type: 'series', name: 'Drama', videos: [] };
  const html = await ndFetchText('/detail/watch/' + slug + '?lang=es-ES');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.replace(/ - Streaming.*/, '').trim() || slug;
  const desc = (html.match(/name="description" content="([^"]*)"/) || [])[1] || '';
  const poster = (html.match(/property="og:image" content="([^"]*)"/) || html.match(/content="([^"]*)"[^>]*property="og:image"/) || [])[1] || '';
  const epMatch = html.match(/episodeItemsRaw\s*=\s*(\[[\s\S]*?\]);/);
  let videos = [];
  if (epMatch) {
    try {
      const eps = JSON.parse(epMatch[1]);
      videos = eps.map(e => ({
        id: 'nd-' + bookId + ':' + e.number, title: e.title || 'Episodio ' + e.number,
        season: 1, episode: e.number, _url: e.direct_play_url || e.play_url || '',
      }));
    } catch (e) { /* parse error */ }
  }
  const val = { id: 'nd-' + bookId, type: 'series', name: title, description: desc, poster, background: poster, videos };
  ND._cache[ck] = { val, ts: Date.now() };
  return val;
}

// Hook into getJSON to intercept virtual addon requests
const _origGetJSON = getJSON;
getJSON = async function(u, ms) {
  const ndMatch = u.match(/^__nartodrama__\/(.+)$/);
  if (!ndMatch) return _origGetJSON(u, ms);
  const path = ndMatch[1];

  // catalog
  if (path.match(/^catalog\/series\/nd-\w+\.json$/)) {
    const items = await ndSections();
    return { metas: items.map(({ _bookId, _watchUrl, ...rest }) => rest) };
  }
  if (path.match(/^catalog\/series\/nd-\w+\/search=(.+)\.json$/)) {
    const q = decodeURIComponent(path.match(/search=(.+)\.json$/)[1]).toLowerCase();
    const items = await ndSections();
    return { metas: items.filter(it => it.name.toLowerCase().includes(q)).map(({ _bookId, _watchUrl, ...rest }) => rest) };
  }

  // meta
  const metaM = path.match(/^meta\/series\/nd-(.+)\.json$/);
  if (metaM) {
    const bookId = metaM[1].split(':')[0];
    const meta = await ndMeta(bookId);
    return { meta };
  }

  // stream
  const streamM = path.match(/^stream\/series\/nd-(.+)\.json$/);
  if (streamM) {
    const parts = streamM[1], ci = parts.lastIndexOf(':');
    if (ci < 0) return { streams: [] };
    const bookId = parts.substring(0, ci), epNum = parseInt(parts.substring(ci + 1), 10);
    const meta = await ndMeta(bookId);
    const vid = meta.videos.find(v => v.episode === epNum);
    if (!vid || !vid._url) return { streams: [] };
    return { streams: [{ url: vid._url, name: 'Narto Drama', title: vid.title }] };
  }

  return { err: 'not found' };
};

/* ───────── addon virtual: SoloLatino.net ───────── */
const SL = {
  base: '__sololatino__',
  manifest: {
    id: 'app.telon.sololatino', version: '1.0.0', name: 'SoloLatino.net',
    description: 'Series, películas, animes y doramas en español latino',
    resources: ['catalog', 'meta', { name: 'stream', types: ['series', 'movie'], idPrefixes: ['sl-', 'tt'] }], types: ['series', 'movie'], idPrefixes: ['sl-'],
    catalogs: [
      { type: 'series', id: 'sl-series', name: 'Series', extra: [{ name: 'search' }] },
      { type: 'series', id: 'sl-animes', name: 'Animes', extra: [{ name: 'search' }] },
      { type: 'series', id: 'sl-doramas', name: 'Doramas', extra: [{ name: 'search' }] },
      { type: 'movie', id: 'sl-peliculas', name: 'Películas', extra: [{ name: 'search' }] },
    ],
  },
  enabled: true,
  _cache: {}, _videoUrls: {}, _imdbIds: {}, _slugs: {}, _names: {},
};
const SL_BASE = 'https://sololatino.net';
const SL_CAT_PATHS = { 'sl-series': '/series', 'sl-animes': '/animes', 'sl-doramas': '/doramas', 'sl-peliculas': '/peliculas' };

async function slFetch(path) {
  const r = await fetch(SL_BASE + path, { headers: { 'Accept-Language': 'es-419,es' }, credentials: 'include' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function slParseCards(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const card of doc.querySelectorAll('.card')) {
    const a = card.querySelector('a[href]');
    if (!a) continue;
    const href = a.getAttribute('href') || '';
    const img = card.querySelector('img');
    const slug = href.replace(/.*\/(serie|pelicula|anime|dorama)\//, '');
    const type = href.includes('/pelicula/') ? 'movie' : 'series';
    out.push({ id: 'sl-' + slug, type, name: (img && img.alt) || slug, poster: (img && img.src) || '', _slug: slug });
  }
  return out;
}

function slParseMeta(html, id) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('h1')?.textContent?.trim() || id;
  const desc = doc.querySelector('meta[name="description"]')?.content || '';
  const poster = doc.querySelector('meta[property="og:image"]')?.content || '';
  const genres = [...doc.querySelectorAll('a[href*="/genero/"]')].map(a => a.textContent.trim());
  const year = doc.querySelector('.text-xs, [class*="year"]')?.textContent?.match(/(\d{4})/)?.[1] || '';
  const videos = [];
  for (const ep of doc.querySelectorAll('a.ep-item, a[class*="ep-item"]')) {
    const href = ep.getAttribute('href') || '';
    const m = href.match(/\/temporada-(\d+)\/episodio-(\d+)/);
    if (!m) continue;
    const epTitle = ep.querySelector('.font-semibold')?.textContent?.trim() || 'Episodio ' + m[2];
    videos.push({ id: 'sl-' + m[1] + 'x' + m[2], title: epTitle, season: +m[1], episode: +m[2], _url: href });
  }
  const imdbLink = doc.querySelector('a[href*="imdb.com/title/tt"]');
  const imdbId = imdbLink ? (imdbLink.href.match(/tt\d+/) || [])[0] : null;
  return { id, type: 'series', name: title, description: desc, poster, background: poster, genres, releaseInfo: year, videos, _imdbId: imdbId };
}

async function slCached(key, fn) {
  if (SL._cache[key] && Date.now() - SL._cache[key].ts < 600000) return SL._cache[key].val;
  const val = await fn();
  SL._cache[key] = { val, ts: Date.now() };
  return val;
}

// Hook SoloLatino into getJSON interceptor
const _prevGetJSON = getJSON;
getJSON = async function(u, ms) {
  const slMatch = u.match(/^__sololatino__\/(.+)$/);
  if (!slMatch) return _prevGetJSON(u, ms);
  const path = slMatch[1];

  // catalog
  const catM = path.match(/^catalog\/(series|movie)\/(sl-\w+)(?:\/search=(.*))?\.json$/);
  if (catM) {
    const catId = catM[2], q = catM[3] ? decodeURIComponent(catM[3]) : '';
    let html;
    if (q) {
      html = await slCached('search:' + q, () => slFetch('/buscar?q=' + encodeURIComponent(q)));
    } else {
      const catPath = SL_CAT_PATHS[catId];
      if (!catPath) return { metas: [] };
      html = await slCached('cat:' + catPath, () => slFetch(catPath));
    }
    return { metas: slParseCards(html).map(({ _slug, ...rest }) => rest) };
  }

  // meta
  const metaM = path.match(/^meta\/(series|movie)\/sl-(.+)\.json$/);
  if (metaM) {
    const slug = metaM[2], type = metaM[1];
    const metaPath = type === 'movie' ? '/pelicula/' + slug : '/serie/' + slug;
    const html = await slCached('meta:' + slug, () => slFetch(metaPath));
    const meta = slParseMeta(html, 'sl-' + slug);
    meta.videos.forEach(v => { if (v._url) SL._videoUrls[v.id] = v._url; if (meta._imdbId) SL._imdbIds[v.id] = meta._imdbId; SL._slugs[v.id] = slug; });
    if (meta._imdbId) SL._imdbIds['sl-' + slug] = meta._imdbId;
    SL._slugs['sl-' + slug] = slug; SL._names['sl-' + slug] = meta.name;
    if (type === 'movie') {
      meta.type = 'movie';
      if (!meta.videos.length) meta.videos = [{ id: 'sl-' + slug, title: meta.name }];
    }
    return { meta };
  }

  // stream — fetch from VPS addon using IMDb ID
  const streamM = path.match(/^stream\/(series|movie)\/sl-(.+)\.json$/);
  if (streamM) {
    const videoId = streamM[2];
    const type = streamM[1];
    const fullId = 'sl-' + videoId;
    let imdbId = SL._imdbIds[fullId] || null;

    // Retry: re-scrape the series/movie page to get IMDb ID
    if (!imdbId) {
      try {
        const seM2 = videoId.match(/^(\d+)x(\d+)$/);
        const slug = seM2 ? SL._slugs[fullId] : videoId;
        if (slug) {
          const metaPath = type === 'movie' ? '/pelicula/' + slug : '/serie/' + slug;
          const html = await slFetch(metaPath);
          const meta = slParseMeta(html, 'sl-' + slug);
          if (meta._imdbId) {
            SL._imdbIds['sl-' + slug] = meta._imdbId;
            meta.videos.forEach(v => { SL._imdbIds[v.id] = meta._imdbId; });
          }
          imdbId = SL._imdbIds[fullId] || meta._imdbId || null;
        }
      } catch(e) {}
    }

    // Fallback: search Cinemeta by name to find IMDb ID
    if (!imdbId) {
      try {
        const seM2 = videoId.match(/^(\d+)x(\d+)$/);
        const slug = seM2 ? SL._slugs[fullId] : videoId;
        const name = SL._names['sl-' + (slug || videoId)] || (slug || videoId).replace(/-/g, ' ');
        const cj = await (await fetch('https://v3-cinemeta.strem.io/catalog/' + type + '/top/search=' + encodeURIComponent(name) + '.json')).json();
        const match = (cj.metas || []).find(m => m.id && m.id.startsWith('tt'));
        if (match) {
          imdbId = match.id;
          SL._imdbIds[fullId] = imdbId;
          if (slug) SL._imdbIds['sl-' + slug] = imdbId;
        }
      } catch(e) {}
    }

    const seM = videoId.match(/^(\d+)x(\d+)$/);
    const streams = [];
    // Try insanos CDN first
    if (imdbId) {
      const stremioId = seM ? imdbId + ':' + seM[1] + ':' + seM[2] : imdbId;
      try {
        const j = await (await fetch('https://insanos.net/sololatino/stream/' + type + '/' + stremioId + '.json')).json();
        (j.streams || []).filter(s => s && s.url).forEach(s => streams.push(s));
      } catch(e) {}
    }
    // Fallback: open sololatino.net episode page as embed
    if (seM) {
      const slug = SL._slugs[fullId] || SL._slugs['sl-' + videoId];
      if (slug) {
        const epUrl = SL_BASE + (type === 'movie' ? '/pelicula/' : '/serie/') + slug + '/temporada-' + seM[1] + '/episodio-' + seM[2];
        streams.push({ url: epUrl, name: 'SoloLatino Web', title: 'Reproductor web (embed)', _type: 'embed' });
      }
    } else if (type === 'movie') {
      const slug = SL._slugs[fullId] || videoId;
      streams.push({ url: SL_BASE + '/pelicula/' + slug, name: 'SoloLatino Web', title: 'Reproductor web (embed)', _type: 'embed' });
    }
    return { streams };
  }

  // stream for tt (IMDb) IDs — route directly to insanos + sololatino.net fallback
  const ttStreamM = path.match(/^stream\/(series|movie)\/(tt.+)\.json$/);
  if (ttStreamM) {
    const stremioId = decodeURIComponent(ttStreamM[2]);
    const type = ttStreamM[1];
    const seM = stremioId.match(/^(tt\d+):(\d+):(\d+)$/);
    if (seM && +seM[2] === 0) return { streams: [] }; // season 0 specials — not on sololatino
    const streams = [];
    try {
      const j = await (await fetch('https://insanos.net/sololatino/stream/' + type + '/' + stremioId + '.json')).json();
      (j.streams || []).filter(s => s && s.url).forEach(s => streams.push(s));
    } catch(e) {}
    // Fallback: open sololatino episode page as embed (Java intercepts the m3u8 and switches to native player)
    if (!streams.length && seM) {
      const imdbBase = seM[1];
      let slug = SL._slugs['tt:' + imdbBase] || null;
      if (!slug) { for (const k in SL._imdbIds) { if (SL._imdbIds[k] === imdbBase && SL._slugs[k]) { slug = SL._slugs[k]; break; } } }
      // Slug guessing via HEAD
      if (!slug) {
        try {
          const cj = await (await fetch('https://v3-cinemeta.strem.io/meta/' + type + '/' + imdbBase + '.json')).json();
          const name = cj.meta && cj.meta.name;
          if (name) {
            const base = name.toLowerCase().replace(/^the\s+/i, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
            for (const p of ['', 'los-', 'las-', 'el-', 'la-']) {
              try {
                const r = await fetch(SL_BASE + '/serie/' + p + base, { method: 'HEAD', credentials: 'include' });
                if (r.ok) { slug = p + base; SL._slugs['tt:' + imdbBase] = slug; break; }
              } catch(e) {}
            }
          }
        } catch(e) {}
      }
      if (slug) {
        streams.push({ url: SL_BASE + '/serie/' + slug + '/temporada-' + seM[2] + '/episodio-' + seM[3], name: 'SoloLatino', title: 'Reproductor SoloLatino (auto)', _type: 'embed' });
      }
    }
    return { streams };
  }

  return { err: 'not found' };
};

const HARDCODED = ['https://insanos.net/cinemeta-es', 'https://insanos.net/sololatino', 'https://insanos.net/narto'];
async function reloadAddons() {
  toast('Recargando addons…');
  const results = await Promise.allSettled(HARDCODED.map(base => _origGetJSON(base + '/manifest.json').then(m => ({ base, manifest: m, enabled: true }))));
  S.addons = [SL, ...results.filter(r => r.status === 'fulfilled').map(r => r.value), ND];
  S.rows = null; S.searchRows = null;
  if (S.addons.length) { render(); loadHome(); toast('Addons recargados'); }
  else { render(); toast('No se pudieron cargar los addons'); }
}
store.set('tvMode', true);
store.set('deviceChosen', true);
document.body.classList.add('tv');
render();
reloadAddons();

/* ───────── actualización ───────── */
(async function checkUpdate() {
  try {
    const j = await (await fetch('https://insanos.net/telon/version.json?t=' + Date.now())).json();
    if (j.version > TELON_VERSION) {
      const el = document.createElement('div');
      el.id = 'updateBanner';
      el.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px">
        <div style="background:var(--surf);border:1px solid var(--outline);border-radius:16px;padding:24px;max-width:320px;width:100%;display:flex;flex-direction:column;gap:14px">
          <h3 style="font-size:20px;font-weight:700;color:var(--on)">Nueva versión disponible</h3>
          <p style="font-size:14px;color:var(--onv);line-height:20px">${esc(j.notes || 'Hay una actualización de Telón.')}</p>
          <p style="font-size:12px;color:var(--onm)">v${j.version} · Actual: v${TELON_VERSION}</p>
          <div style="display:flex;gap:10px" id="updateBtns">
            <button class="btn" onclick="try{TelonBridge.downloadAndInstall('${esc(j.url)}');document.getElementById('updateBtns').innerHTML='<div class=\\'spin\\'></div><span style=\\'font-size:13px;color:var(--onv)\\'>Descargando…</span>'}catch(e){window.open('${esc(j.url)}');this.closest('#updateBanner').remove()}">Actualizar</button>
            <button class="btn out" onclick="this.closest('#updateBanner').remove()">Luego</button>
          </div>
        </div>
      </div>`;
      document.body.appendChild(el);
    }
  } catch(e) {}
})();

/* ───────── auth state (REST — no auto-session) ───────── */

/* ───────── TV remote (called from Java onKeyDown) ───────── */
function _tvNav(dir) {
  const all = [...document.querySelectorAll('button,a,input,[tabindex]')].filter(el => {
    if (el.hidden || el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!all.length) return;
  const cur = document.activeElement;
  if (!cur || cur === document.body || !all.includes(cur)) {
    const first = document.querySelector('#nav button.on,#nav button') || all[0];
    if (first) first.focus();
    return;
  }
  const rect = cur.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const horiz = dir === 'left' || dir === 'right';
  let best = null, bestScore = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
    const dx = ex - cx, dy = ey - cy;
    if (dir === 'right' && dx < 20) continue;
    if (dir === 'left' && dx > -20) continue;
    if (dir === 'down' && dy < 20) continue;
    if (dir === 'up' && dy > -20) continue;
    let score;
    if (horiz) {
      const sameRow = Math.abs(dy) < Math.max(rect.height * 0.7, 25);
      score = sameRow ? Math.abs(dx) : Math.abs(dx) + Math.abs(dy) * 10;
    } else {
      const sameCol = Math.abs(dx) < Math.max(rect.width * 0.7, 25);
      score = sameCol ? Math.abs(dy) : Math.abs(dy) + Math.abs(dx) * 3;
    }
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
window._tvKey = function(kc) {
  const P = S.player;
  if (P && P.video) {
    const v = P.video;
    if (kc === 85) { if (v.paused) v.play().catch(()=>{}); else v.pause(); return; }
    if (kc === 126) { v.play().catch(()=>{}); return; }
    if (kc === 127) { v.pause(); return; }
    if (kc === 86) { closePlayer(); return; }
    if (kc === 89 || kc === 21) { v.currentTime = Math.max(0, v.currentTime - 10); return; }
    if (kc === 90 || kc === 22) { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); return; }
    if (kc === 87) { if (P.idx < P.videos.length - 1) loadVideo(P.idx + 1); return; }
    if (kc === 88) { if (P.idx > 0) loadVideo(P.idx - 1); return; }
    if (kc === 23 || kc === 66) { if (v.paused) v.play().catch(()=>{}); else v.pause(); return; }
    if (kc === 19 || kc === 20) return;
  }
  const f = document.activeElement;
  if (kc === 23 || kc === 66) { if (f && f !== document.body) f.click(); return; }
  if (kc === 19) _tvNav('up');
  else if (kc === 20) _tvNav('down');
  else if (kc === 21) _tvNav('left');
  else if (kc === 22) _tvNav('right');
};
})();
