/* ===== Suivi Heures de Travail — localStorage (cache) + Supabase (cloud) ===== */

const STORAGE_ENTRIES = 'wh_entries_v1';
const STORAGE_SETTINGS = 'wh_settings_v1';

const SUPABASE_URL = 'https://hqwqplhmntxyxttuqqhi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd3FwbGhtbnR4eXh0dHVxcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MjY0NDEsImV4cCI6MjEwMzQwMjQ0MX0.fR6vAb7kkgZKx64TidHgbjhOxdDRNRf5VpW5N7Lvjr0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// lien d'invitation / réinitialisation Supabase : ?...#access_token=...&type=invite (ou "recovery")
// on le lit tout de suite, avant que quoi que ce soit ne touche au hash de l'URL
let authRedirectType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');

let currentUser = null;
let lastSyncedEntryIds = new Set(); // pour détecter les suppressions à synchroniser

const WEEKDAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const WEEKDAYS_SHORT = ['D','L','M','M','J','V','S'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_FR_SHORT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

const TYPE_INFO = {
  normal: { label: 'Normal', icon: '' },
  conge: { label: 'Congé', icon: '🌴' },
  ferie: { label: 'Férié', icon: '🎌' },
  repos: { label: 'Repos exceptionnel', icon: '🛌' },
  absence: { label: 'Absence', icon: '🚫' },
};

// ---------- storage ----------

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_SETTINGS);
  if (raw) {
    try { return Object.assign(defaultSettings(), JSON.parse(raw)); } catch (e) {}
  }
  return defaultSettings();
}

function defaultSettings() {
  return { requiredHours: 8.5, offDays: [0, 6], cycleStartDay: 26 }; // dimanche + samedi ; cycle du 26 au 25
}

// jour de début de cycle borné à 1..28 (pour exister dans tous les mois)
function cycleStartDay() {
  const d = parseInt(settings.cycleStartDay, 10);
  if (!d || d < 1) return 1;
  return Math.min(28, d);
}

// sauvegarde locale (cache) + synchro Supabase en arrière-plan (une seule ligne, upsert)
async function saveSettings(s) {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s));
  if (!currentUser) return;
  try {
    const { error } = await supabaseClient.from('settings').upsert(settingsToRow(s));
    if (error) throw error;
  } catch (err) {
    console.error('Sync settings error', err);
    toast('⚠️ Erreur de synchronisation des réglages');
  }
}

function normalizeEntries(list) {
  return (list || []).map(e => ({ type: 'normal', permission: 0, notes: '', ...e }));
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_ENTRIES);
  if (raw) {
    try { return normalizeEntries(JSON.parse(raw)); } catch (e) {}
  }
  return [];
}

// sauvegarde locale (cache) + synchro Supabase en arrière-plan :
// upsert de toutes les lignes présentes, suppression de celles qui ont disparu depuis le dernier sync
async function saveEntries(list) {
  localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(list));
  if (!currentUser) return;
  const currentIds = new Set(list.map(e => e.id));
  const removedIds = [...lastSyncedEntryIds].filter(id => !currentIds.has(id));
  lastSyncedEntryIds = currentIds;
  try {
    if (list.length) {
      const { error } = await supabaseClient.from('entries').upsert(list.map(entryToRow));
      if (error) throw error;
    }
    if (removedIds.length) {
      const { error } = await supabaseClient.from('entries').delete().in('id', removedIds);
      if (error) throw error;
    }
  } catch (err) {
    console.error('Sync entries error', err);
    toast('⚠️ Erreur de synchronisation');
  }
}

// ---------- mapping JS (camelCase) <-> colonnes Supabase (snake_case) ----------

function entryToRow(e) {
  return {
    id: e.id,
    user_id: currentUser.id,
    date: e.date,
    type: e.type || 'normal',
    checkin: e.checkIn || null,
    checkout: e.checkOut || null,
    required: e.required || 0,
    permission: e.permission || 0,
    notes: e.notes || '',
  };
}

function rowToEntry(r) {
  return {
    id: r.id,
    date: r.date,
    type: r.type || 'normal',
    checkIn: r.checkin || '',
    checkOut: r.checkout || '',
    required: r.required,
    permission: r.permission || 0,
    notes: r.notes || '',
  };
}

function settingsToRow(s) {
  return {
    user_id: currentUser.id,
    required_hours: s.requiredHours,
    off_days: s.offDays,
    cycle_start_day: s.cycleStartDay,
  };
}

function rowToSettings(r) {
  return {
    requiredHours: r.required_hours,
    offDays: r.off_days,
    cycleStartDay: r.cycle_start_day,
  };
}

let settings = loadSettings();
let entries = loadEntries();
let editingId = null;

// ---------- utils ----------

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  // repli si crypto.randomUUID indisponible (contexte non sécurisé / vieux navigateur)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function nowHM() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function pad(n) { return String(n).padStart(2, '0'); }

function dateToDow(dateStr) {
  // dateStr = 'YYYY-MM-DD' -> avoid timezone issues by constructing local date
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isOffDay(dateStr) {
  return settings.offDays.includes(dateToDow(dateStr));
}

function longDateFR(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS_FR[dow]} ${d} ${MONTHS_FR[m - 1]}`;
}

function dateStrOf(dateObj) {
  return dateObj.getFullYear() + '-' + pad(dateObj.getMonth() + 1) + '-' + pad(dateObj.getDate());
}

// ---------- cycle mensuel (période de paie) ----------
// Un "cursor" est une Date positionnée sur le 1er du mois où DÉMARRE la période.

function periodBounds(cursor) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const sd = cycleStartDay();
  const start = new Date(y, m, sd);
  const end = new Date(y, m + 1, sd - 1); // veille du jour de début, le mois suivant
  return { start, end, startStr: dateStrOf(start), endStr: dateStrOf(end) };
}

function periodLabel(cursor) {
  const { start, end } = periodBounds(cursor);
  if (cycleStartDay() === 1) {
    return `${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const left = `${start.getDate()} ${MONTHS_FR_SHORT[start.getMonth()]}${sameYear ? '' : ' ' + start.getFullYear()}`;
  const right = `${end.getDate()} ${MONTHS_FR_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  return `${left} – ${right}`;
}

// période contenant aujourd'hui
function currentPeriodCursor() {
  const now = new Date();
  const c = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate() < cycleStartDay()) c.setMonth(c.getMonth() - 1);
  return c;
}

function eachDateInPeriod(cursor) {
  const { start, end } = periodBounds(cursor);
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    out.push({ dateStr: dateStrOf(d), day: d.getDate(), month: d.getMonth() });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// libellé court d'un jour pour les listes d'alertes (26, 27 … ou 3/8 si ambigu)
function dayTag(day, month) {
  return cycleStartDay() === 1 ? String(day) : `${day}/${month + 1}`;
}

// ---------- 24h time selects (avoid AM/PM native time input on some devices) ----------

function hourOptions(selected, placeholder) {
  let html = placeholder ? `<option value=""${!selected ? ' selected' : ''}>--</option>` : '';
  for (let h = 0; h < 24; h++) {
    const v = pad(h);
    html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
  }
  return html;
}

function minuteOptions(selected, placeholder) {
  let html = placeholder ? `<option value=""${!selected ? ' selected' : ''}>--</option>` : '';
  for (let m = 0; m < 60; m++) {
    const v = pad(m);
    html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
  }
  return html;
}

function getSelectTime(hEl, mEl) {
  if (!hEl.value || !mEl.value) return '';
  return hEl.value + ':' + mEl.value;
}

function setSelectTime(hEl, mEl, value) {
  const [h, m] = (value || '').split(':');
  hEl.value = h || '';
  mEl.value = m || '';
}

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtHM(totalMinutes, forceSign) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '--';
  const sign = totalMinutes < 0 ? '-' : (forceSign ? '+' : '');
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${pad(m)}`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.remove('show'), 1800);
}

function sortedEntries() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function entryForDate(dateStr) {
  return entries.find(e => e.date === dateStr);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- computation ----------

function computeEntry(entry) {
  const requiredMin = Math.round((entry.required || 0) * 60);
  const ciMin = timeToMin(entry.checkIn);
  const coMin = timeToMin(entry.checkOut);
  let workedMin = null;
  if (ciMin !== null && coMin !== null) {
    let diff = coMin - ciMin;
    if (diff < 0) diff += 24 * 60; // overnight shift
    workedMin = diff;
  }
  const hasFullEntry = workedMin !== null;
  const effectiveWorked = hasFullEntry ? workedMin : 0;
  const diffMin = effectiveWorked - requiredMin;
  const overtimeMin = diffMin > 0 ? diffMin : 0;
  const permMin = Math.round(entry.permission || 0);
  const netMin = diffMin + permMin;

  return { requiredMin, workedMin, hasFullEntry, diffMin, overtimeMin, permMin, netMin };
}

// running cumulation across full history, chronological order
function computeCumulationMap() {
  const map = {};
  let running = 0;
  for (const e of sortedEntries()) {
    const c = computeEntry(e);
    running += c.netMin;
    map[e.id] = running;
  }
  return map;
}

// ---------- upsert helper (shared by quick actions + manual form) ----------

function upsertEntryForDate(dateStr, patch) {
  let e = entryForDate(dateStr);
  if (!e) {
    e = { id: uid(), date: dateStr, checkIn: '', checkOut: '', required: isOffDay(dateStr) ? 0 : settings.requiredHours, permission: 0, notes: '', type: 'normal' };
    entries.push(e);
  }
  Object.assign(e, patch);
  saveEntries(entries);
  return e;
}

function refreshAll() {
  updateTopBadge();
  const activeView = document.querySelector('.view.active');
  if (activeView && activeView.id === 'view-historique') renderHistory();
  if (activeView && activeView.id === 'view-dashboard') renderDashboard();
}

// ---------- tabs ----------

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'saisie') renderToday();
  if (name === 'historique') renderHistory();
  if (name === 'dashboard') renderDashboard();
  if (name === 'reglages') renderSettings();
  updateTopBadge();
}

// ================= TODAY WIDGET (check-in / check-out en un tap) =================

let todayEditingField = null; // 'checkIn' | 'checkOut' | null

function renderToday() {
  const dateStr = todayStr();
  const entry = entryForDate(dateStr);
  const type = entry ? (entry.type || 'normal') : (isOffDay(dateStr) ? 'off-implicit' : 'normal');
  const card = document.getElementById('todayCard');

  const head = `
    <div class="today-head"><div class="today-date">${longDateFR(dateStr)}</div></div>
    <div class="today-sub">Aujourd'hui</div>`;

  // jour de repos implicite (weekend), rien d'enregistré
  if (type === 'off-implicit') {
    card.innerHTML = head + `
      <div class="statusBadge off">😴 Jour de repos</div>
      <div class="chipRow">
        <button class="chip" onclick="quickForceWork()">💼 J'ai travaillé aujourd'hui</button>
        <button class="chip" onclick="quickSetType('conge')">🌴 Congé</button>
        <button class="chip" onclick="quickSetType('absence')">🚫 Absence</button>
      </div>`;
    return;
  }

  // congé / férié / repos exceptionnel explicitement marqué
  if (type === 'conge' || type === 'ferie' || type === 'repos') {
    const info = TYPE_INFO[type];
    card.innerHTML = head + `
      <div class="statusBadge leave">${info.icon} ${info.label}</div>
      <button class="smallLink" onclick="quickResetToday()">↺ Revenir à une journée normale</button>`;
    return;
  }

  // absence explicite
  if (type === 'absence') {
    card.innerHTML = head + `
      <div class="statusBadge absence">🚫 Absence enregistrée</div>
      <button class="smallLink" onclick="quickResetToday()">↺ Revenir à une journée normale</button>`;
    return;
  }

  // journée normale : pas encore de check-in
  if (!entry || !entry.checkIn) {
    card.innerHTML = head + `
      <button class="bigAction checkin" onclick="quickCheckIn()"><span class="ic">🟢</span> Pointer l'arrivée</button>
      <div class="chipRow">
        <button class="chip" onclick="quickSetType('conge')">🌴 Congé</button>
        <button class="chip" onclick="quickSetType('ferie')">🎌 Férié</button>
        <button class="chip" onclick="quickSetType('repos')">🛌 Repos</button>
        <button class="chip" onclick="quickSetType('absence')">🚫 Absence</button>
      </div>`;
    return;
  }

  // check-in fait, pas encore de check-out
  if (entry.checkIn && !entry.checkOut) {
    card.innerHTML = head + renderTimePill('checkIn', entry.checkIn, 'Arrivée') + `
      <button class="bigAction checkout" onclick="quickCheckOut()"><span class="ic">🔴</span> Pointer la sortie</button>
      <button class="smallLink danger" onclick="quickResetToday()">↺ Annuler l'arrivée</button>`;
    return;
  }

  // journée complète : résumé
  const c = computeEntry(entry);
  card.innerHTML = head +
    renderTimePill('checkIn', entry.checkIn, 'Arrivée') +
    renderTimePill('checkOut', entry.checkOut, 'Sortie') +
    `<div class="summaryGrid">
      <div class="mini"><div class="ml">Travaillé</div><div class="mv">${fmtHM(c.workedMin)}</div></div>
      <div class="mini"><div class="ml">Requis</div><div class="mv">${fmtHM(c.requiredMin)}</div></div>
      <div class="mini"><div class="ml">Écart</div><div class="mv ${c.diffMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.diffMin, true)}</div></div>
      <div class="mini"><div class="ml">Supplémentaire</div><div class="mv">${fmtHM(c.overtimeMin)}</div></div>
    </div>
    <div class="rowActions">
      <button class="smallLink" onclick="openManualEdit('${entry.id}')">✎ Modifier / permission / notes</button>
      <button class="smallLink danger" onclick="quickResetToday()">↺ Réinitialiser la journée</button>
    </div>`;
}

function renderTimePill(field, value, label) {
  if (todayEditingField === field) {
    const [h, m] = (value || '').split(':');
    return `<div class="timePill editing">
      <div class="tp-label">${label}</div>
      <div class="timePicker">
        <select id="todayTimeInputH" class="timeSel">${hourOptions(h)}</select><span class="timeColon">:</span><select id="todayTimeInputM" class="timeSel">${minuteOptions(m)}</select>
      </div>
      <div class="editRow">
        <button class="btn primary" style="padding:9px" onclick="saveEditTime('${field}')">✓ Valider</button>
        <button class="btn ghost" style="padding:9px" onclick="cancelEditTime()">Annuler</button>
      </div>
    </div>`;
  }
  return `<div class="timeRow"><div class="timePill">
    <div class="tp-label">${label}</div>
    <div class="tp-value">${value}</div>
    <button class="tp-edit" onclick="startEditTime('${field}')">✎</button>
  </div></div>`;
}

function quickCheckIn() {
  const t = nowHM();
  upsertEntryForDate(todayStr(), { checkIn: t, type: 'normal' });
  toast('Arrivée enregistrée à ' + t);
  renderToday();
  refreshAll();
}

function quickCheckOut() {
  const t = nowHM();
  upsertEntryForDate(todayStr(), { checkOut: t });
  toast('Sortie enregistrée à ' + t);
  renderToday();
  refreshAll();
}

function quickForceWork() {
  upsertEntryForDate(todayStr(), { type: 'normal', required: settings.requiredHours });
  renderToday();
}

function quickSetType(type) {
  const dateStr = todayStr();
  const req = type === 'absence' ? (isOffDay(dateStr) ? 0 : settings.requiredHours) : 0;
  upsertEntryForDate(dateStr, { type, checkIn: '', checkOut: '', required: req });
  toast('Journée marquée : ' + TYPE_INFO[type].label);
  renderToday();
  refreshAll();
}

function quickResetToday() {
  const dateStr = todayStr();
  const e = entryForDate(dateStr);
  if (e && e.checkIn && e.checkOut) {
    if (!confirm('Réinitialiser les heures de la journée ?')) return;
  }
  entries = entries.filter(x => x.date !== dateStr);
  saveEntries(entries);
  todayEditingField = null;
  renderToday();
  refreshAll();
}

function startEditTime(field) {
  todayEditingField = field;
  renderToday();
  setTimeout(() => { const el = document.getElementById('todayTimeInputH'); if (el) el.focus(); }, 0);
}

function cancelEditTime() {
  todayEditingField = null;
  renderToday();
}

function saveEditTime(field) {
  const hEl = document.getElementById('todayTimeInputH');
  const mEl = document.getElementById('todayTimeInputM');
  if (!hEl || !mEl) { toast('Heure invalide'); return; }
  upsertEntryForDate(todayStr(), { [field]: hEl.value + ':' + mEl.value });
  todayEditingField = null;
  toast('Heure mise à jour');
  renderToday();
  refreshAll();
}

function openManualEdit(id) {
  editEntry(id);
}

// ---------- manual form toggle ----------

const manualToggleBtn = document.getElementById('toggleManualForm');
const manualCard = document.getElementById('manualFormCard');
const manualArrow = document.getElementById('toggleManualArrow');

manualToggleBtn.addEventListener('click', () => {
  const willShow = manualCard.style.display === 'none';
  setManualFormVisible(willShow);
  if (willShow) manualCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function setManualFormVisible(visible) {
  manualCard.style.display = visible ? 'block' : 'none';
  manualArrow.textContent = visible ? '▴' : '▾';
  manualToggleBtn.firstChild.textContent = visible ? '📅 Masquer la saisie manuelle ' : '📅 Ajouter ou corriger un autre jour ';
}

// ---------- SAISIE (manual form) ----------

const f = {
  date: document.getElementById('f-date'),
  daybadge: document.getElementById('f-daybadge'),
  type: document.getElementById('f-type'),
  timeRow: document.getElementById('f-timeRow'),
  checkinH: document.getElementById('f-checkin-h'),
  checkinM: document.getElementById('f-checkin-m'),
  checkoutH: document.getElementById('f-checkout-h'),
  checkoutM: document.getElementById('f-checkout-m'),
  required: document.getElementById('f-required'),
  permission: document.getElementById('f-permission'),
  notes: document.getElementById('f-notes'),
  preview: document.getElementById('f-preview'),
  submit: document.getElementById('f-submit'),
  cancel: document.getElementById('f-cancel'),
};

f.checkinH.innerHTML = hourOptions('', true);
f.checkinM.innerHTML = minuteOptions('', true);
f.checkoutH.innerHTML = hourOptions('', true);
f.checkoutM.innerHTML = minuteOptions('', true);

function getFormCheckIn() { return getSelectTime(f.checkinH, f.checkinM); }
function getFormCheckOut() { return getSelectTime(f.checkoutH, f.checkoutM); }
function setFormCheckIn(v) { setSelectTime(f.checkinH, f.checkinM, v); }
function setFormCheckOut(v) { setSelectTime(f.checkoutH, f.checkoutM, v); }

f.date.value = todayStr();
updateDayBadge();
f.required.value = isOffDay(f.date.value) ? 0 : settings.requiredHours;

f.date.addEventListener('change', () => {
  updateDayBadge();
  if (!editingId) {
    f.required.value = isOffDay(f.date.value) ? 0 : settings.requiredHours;
  }
  updatePreview();
});

f.type.addEventListener('change', () => {
  updateTypeFieldsVisibility();
  if (f.type.value !== 'normal' && f.type.value !== 'absence') {
    f.required.value = 0;
  } else if (f.type.value === 'absence') {
    f.required.value = isOffDay(f.date.value) ? 0 : settings.requiredHours;
  }
  updatePreview();
});

function updateTypeFieldsVisibility() {
  const showTimes = f.type.value === 'normal';
  f.timeRow.style.display = showTimes ? 'grid' : 'none';
  if (!showTimes) { setFormCheckIn(''); setFormCheckOut(''); }
}

[f.checkinH, f.checkinM, f.checkoutH, f.checkoutM].forEach(el => {
  el.addEventListener('change', updatePreview);
});
[f.required, f.permission].forEach(el => {
  el.addEventListener('input', updatePreview);
});

function updateDayBadge() {
  const dow = dateToDow(f.date.value);
  const off = settings.offDays.includes(dow);
  f.daybadge.textContent = WEEKDAYS_FR[dow] + (off ? ' · jour non travaillé' : '');
  f.daybadge.classList.toggle('off', off);
}

function updatePreview() {
  const tmp = {
    checkIn: getFormCheckIn(),
    checkOut: getFormCheckOut(),
    required: parseFloat(f.required.value) || 0,
    permission: parseFloat(f.permission.value) || 0,
  };
  const c = computeEntry(tmp);
  if (f.type.value !== 'normal') {
    f.preview.innerHTML = `Type : <b>${TYPE_INFO[f.type.value].icon} ${TYPE_INFO[f.type.value].label}</b> — heures requises : <b>${fmtHM(c.requiredMin)}</b>, net du jour : <b class="${c.netMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.netMin, true)}</b>`;
    return;
  }
  if (!c.hasFullEntry) {
    f.preview.innerHTML = `Heures requises : <b>${fmtHM(c.requiredMin)}</b> — renseignez l'entrée et la sortie pour voir le calcul complet.`;
    return;
  }
  f.preview.innerHTML =
    `Travaillé : <b>${fmtHM(c.workedMin)}</b> &nbsp;·&nbsp; Requis : <b>${fmtHM(c.requiredMin)}</b><br>` +
    `Écart : <b class="${c.diffMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.diffMin, true)}</b> &nbsp;·&nbsp; Supplémentaire : <b>${fmtHM(c.overtimeMin)}</b><br>` +
    `Permission : <b>${fmtHM(c.permMin)}</b> &nbsp;·&nbsp; Net du jour : <b class="${c.netMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.netMin, true)}</b>`;
}
updatePreview();

document.getElementById('entryForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entry = {
    id: editingId || uid(),
    date: f.date.value,
    type: f.type.value,
    checkIn: f.type.value === 'normal' ? getFormCheckIn() : '',
    checkOut: f.type.value === 'normal' ? getFormCheckOut() : '',
    required: parseFloat(f.required.value) || 0,
    permission: parseFloat(f.permission.value) || 0,
    notes: f.notes.value.trim(),
  };
  if (!entry.date) { toast('Choisissez une date'); return; }

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx >= 0) entries[idx] = entry;
    toast('Journée modifiée');
  } else {
    const existing = entries.findIndex(e => e.date === entry.date);
    if (existing >= 0) {
      entries[existing] = entry;
      toast('Journée mise à jour (date existante)');
    } else {
      entries.push(entry);
      toast('Journée enregistrée');
    }
  }
  saveEntries(entries);
  resetForm();
  renderToday();
  refreshAll();
});

f.cancel.addEventListener('click', resetForm);

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Nouvelle journée';
  f.submit.textContent = 'Enregistrer';
  f.cancel.style.display = 'none';
  f.date.value = todayStr();
  f.type.value = 'normal';
  setFormCheckIn('');
  setFormCheckOut('');
  f.permission.value = 0;
  f.notes.value = '';
  updateDayBadge();
  updateTypeFieldsVisibility();
  f.required.value = isOffDay(f.date.value) ? 0 : settings.requiredHours;
  updatePreview();
}

function editEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  document.getElementById('formTitle').textContent = 'Modifier la journée';
  f.submit.textContent = 'Mettre à jour';
  f.cancel.style.display = 'block';
  f.date.value = e.date;
  f.type.value = e.type || 'normal';
  setFormCheckIn(e.checkIn || '');
  setFormCheckOut(e.checkOut || '');
  f.required.value = e.required;
  f.permission.value = e.permission || 0;
  f.notes.value = e.notes || '';
  updateDayBadge();
  updateTypeFieldsVisibility();
  updatePreview();
  switchView('saisie');
  setManualFormVisible(true);
  manualCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteEntry(id) {
  if (!confirm('Supprimer cette journée ?')) return;
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  renderHistory();
  renderDashboard();
  if (entryForDate(todayStr()) === undefined) renderToday();
  updateTopBadge();
  toast('Journée supprimée');
}

// ---------- top badge ----------

function updateTopBadge() {
  const map = computeCumulationMap();
  const list = sortedEntries();
  const last = list[list.length - 1];
  const val = last ? map[last.id] : 0;
  const el = document.getElementById('topCumul');
  el.textContent = 'Cumul : ' + fmtHM(val, true);
  el.style.color = val < 0 ? '#ff9aa4' : '#cdd8ff';
}

// ---------- HISTORIQUE ----------

let histCursor = currentPeriodCursor(); // curseur de période (1er du mois de début de cycle)

document.getElementById('hist-prev').addEventListener('click', () => { histCursor.setMonth(histCursor.getMonth() - 1); renderHistory(); });
document.getElementById('hist-next').addEventListener('click', () => { histCursor.setMonth(histCursor.getMonth() + 1); renderHistory(); });

function renderHistory() {
  document.getElementById('hist-monthLabel').textContent = periodLabel(histCursor);

  const { startStr, endStr } = periodBounds(histCursor);
  const cumulMap = computeCumulationMap();
  const monthEntries = sortedEntries().filter(e => e.date >= startStr && e.date <= endStr);

  let worked = 0, required = 0, diff = 0;
  for (const e of monthEntries) {
    const c = computeEntry(e);
    worked += c.hasFullEntry ? c.workedMin : 0;
    required += c.requiredMin;
    diff += c.diffMin;
  }
  document.getElementById('histSummary').innerHTML = `
    <div class="chipStat"><div class="csl">Travaillé</div><div class="csv">${fmtHM(worked)}</div></div>
    <div class="chipStat"><div class="csl">Requis</div><div class="csv">${fmtHM(required)}</div></div>
    <div class="chipStat"><div class="csl">Écart</div><div class="csv ${diff >= 0 ? 'pos' : 'neg'}">${fmtHM(diff, true)}</div></div>`;

  const list = document.getElementById('hist-list');
  list.innerHTML = '';
  document.getElementById('hist-empty').style.display = monthEntries.length ? 'none' : 'block';

  for (const e of monthEntries) {
    const c = computeEntry(e);
    const type = e.type || 'normal';
    const dow = dateToDow(e.date);
    const [, , d] = e.date.split('-');

    let statusClass = 'ok';
    if (type !== 'normal') statusClass = type === 'absence' ? 'absence' : 'leave';
    else if (!c.hasFullEntry || c.diffMin < 0) statusClass = 'warn';

    let title, sub;
    if (type !== 'normal') {
      title = `${TYPE_INFO[type].icon} ${TYPE_INFO[type].label}`;
      sub = e.notes || '';
    } else {
      title = c.hasFullEntry ? `${e.checkIn} → ${e.checkOut}` : (e.checkIn ? `${e.checkIn} → en cours` : 'Non pointé');
      sub = [c.hasFullEntry ? `Travaillé ${fmtHM(c.workedMin)}` : '', e.notes].filter(Boolean).join(' · ');
    }

    const row = document.createElement('div');
    row.className = 'dayRow status-' + statusClass;
    row.innerHTML = `
      <div class="dateBlock"><div class="dnum">${d}</div><div class="ddow">${WEEKDAYS_SHORT[dow]}</div></div>
      <div class="dayInfo"><div class="dTitle">${escapeHtml(title)}</div><div class="dSub">${escapeHtml(sub)}</div></div>
      <div class="dayRight">
        <div class="dPill ${c.netMin >= 0 ? 'pillPos' : 'pillNeg'}">${fmtHM(c.netMin, true)}</div>
        <div class="dCumul">Cumul ${fmtHM(cumulMap[e.id], true)}</div>
      </div>
      <button class="dayDelete" title="Supprimer">✕</button>`;
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('.dayDelete')) return;
      editEntry(e.id);
    });
    row.querySelector('.dayDelete').addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEntry(e.id);
    });
    list.appendChild(row);
  }
}

// ---------- DASHBOARD ----------

let dashCursor = currentPeriodCursor(); // curseur de période (1er du mois de début de cycle)

document.getElementById('dash-prev').addEventListener('click', () => { dashCursor.setMonth(dashCursor.getMonth() - 1); renderDashboard(); });
document.getElementById('dash-next').addEventListener('click', () => { dashCursor.setMonth(dashCursor.getMonth() + 1); renderDashboard(); });

function renderDashboard() {
  document.getElementById('dash-monthLabel').textContent = periodLabel(dashCursor);

  const days = eachDateInPeriod(dashCursor);
  const { endStr } = periodBounds(dashCursor);
  const today = todayStr();
  const entryByDate = {};
  for (const e of entries) entryByDate[e.date] = e;

  let worked = 0, required = 0, overtime = 0, diff = 0, perm = 0;
  const dayInfos = [];

  for (const { dateStr, day, month } of days) {
    const off = isOffDay(dateStr);
    const e = entryByDate[dateStr];
    const isFuture = dateStr > today;
    const type = e ? (e.type || 'normal') : null;

    if (e && type !== 'normal') {
      const c = computeEntry(e);
      required += c.requiredMin;
      diff += c.diffMin;
      perm += c.permMin;
      const status = type === 'absence' ? 'absence' : 'leave';
      dayInfos.push({ day, month, tag: dayTag(day, month), dateStr, off, net: c.netMin, status, type });
    } else if (e) {
      const c = computeEntry(e);
      worked += c.hasFullEntry ? c.workedMin : 0;
      required += c.requiredMin;
      overtime += c.overtimeMin;
      diff += c.diffMin;
      perm += c.permMin;
      let status = 'ok';
      if (!c.hasFullEntry && (e.checkIn || e.checkOut)) status = 'warn';
      else if (c.diffMin < 0) status = 'warn';
      dayInfos.push({ day, month, tag: dayTag(day, month), dateStr, off, net: c.netMin, status, partial: !!(e.checkIn && !e.checkOut) });
    } else if (off) {
      dayInfos.push({ day, month, tag: dayTag(day, month), dateStr, off: true, net: 0, status: 'off' });
    } else if (isFuture) {
      dayInfos.push({ day, month, tag: dayTag(day, month), dateStr, off: false, net: 0, status: 'future' });
    } else {
      // workday in the past with no entry at all = pointage oublié
      const reqMin = Math.round(settings.requiredHours * 60);
      required += reqMin;
      diff += -reqMin;
      dayInfos.push({ day, month, tag: dayTag(day, month), dateStr, off: false, net: -reqMin, status: 'miss' });
    }
  }

  const pct = required > 0 ? Math.round((worked / required) * 100) : (worked > 0 ? 100 : 0);
  const fillEl = document.getElementById('progressFill');
  fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
  fillEl.classList.toggle('over', pct >= 100);
  document.getElementById('progressPct').textContent = pct + '%';

  document.getElementById('s-worked').textContent = fmtHM(worked);
  document.getElementById('s-required').textContent = fmtHM(required);
  document.getElementById('s-overtime').textContent = fmtHM(overtime);
  const diffEl = document.getElementById('s-diff');
  diffEl.textContent = fmtHM(diff, true);
  diffEl.className = 'stat-value ' + (diff >= 0 ? 'good' : '');
  diffEl.style.color = diff < 0 ? 'var(--bad)' : '';
  document.getElementById('s-perm').textContent = fmtHM(perm);

  // cumul en fin de période = dernière valeur cumulée pour une date <= fin de période
  const cumulMap = computeCumulationMap();
  const upTo = sortedEntries().filter(e => e.date <= endStr);
  const lastEntry = upTo[upTo.length - 1];
  const cumulEl = document.getElementById('s-cumul');
  const cumulVal = lastEntry ? cumulMap[lastEntry.id] : 0;
  cumulEl.textContent = fmtHM(cumulVal, true);
  cumulEl.style.color = cumulVal < 0 ? 'var(--bad)' : 'var(--good)';

  renderCalendar(dayInfos, periodBounds(dashCursor).start);
  renderAlerts(dayInfos);
}

function renderCalendar(dayInfos, startDate) {
  const weekdaysEl = document.getElementById('calWeekdays');
  if (!weekdaysEl.childElementCount) {
    weekdaysEl.innerHTML = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div>${d}</div>`).join('');
  }

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDow = startDate.getDay(); // 0=dimanche..6=samedi
  const leading = (firstDow + 6) % 7; // décalage pour semaine commençant le lundi
  for (let i = 0; i < leading; i++) {
    const empty = document.createElement('div');
    empty.className = 'calCell empty';
    grid.appendChild(empty);
  }

  const today = todayStr();
  for (const d of dayInfos) {
    const cell = document.createElement('div');
    let cls = d.status === 'miss' ? 'absence' : d.status;
    cell.className = 'calCell ' + cls + (d.status === 'miss' ? ' unconfirmed' : '') + (d.dateStr === today ? ' today' : '');
    const icon = d.type ? TYPE_INFO[d.type].icon : '';
    cell.innerHTML = `<div class="cNum">${d.day}</div>${icon ? `<div class="cIcon">${icon}</div>` : ''}`;
    cell.title = `${d.day} : ${fmtHM(d.net, true)}`;
    cell.addEventListener('click', () => openDateFromCalendar(d.dateStr));
    grid.appendChild(cell);
  }
}

function openDateFromCalendar(dateStr) {
  const e = entryForDate(dateStr);
  if (e) { editEntry(e.id); return; }
  editingId = null;
  document.getElementById('formTitle').textContent = 'Nouvelle journée';
  f.submit.textContent = 'Enregistrer';
  f.cancel.style.display = 'none';
  f.date.value = dateStr;
  f.type.value = 'normal';
  setFormCheckIn('');
  setFormCheckOut('');
  f.permission.value = 0;
  f.notes.value = '';
  updateDayBadge();
  updateTypeFieldsVisibility();
  f.required.value = isOffDay(dateStr) ? 0 : settings.requiredHours;
  updatePreview();
  switchView('saisie');
  setManualFormVisible(true);
  manualCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAlerts(dayInfos) {
  const ul = document.getElementById('alertList');
  ul.innerHTML = '';
  const missing = dayInfos.filter(d => d.status === 'miss');
  const partial = dayInfos.filter(d => d.status === 'warn' && d.partial);
  const negatives = dayInfos.filter(d => d.status === 'warn' && !d.partial);
  const absences = dayInfos.filter(d => d.status === 'absence');
  const leaves = dayInfos.filter(d => d.status === 'leave');

  const items = [];
  if (missing.length) items.push({ text: `${missing.length} jour(s) sans pointage : ${missing.map(d => d.tag).join(', ')}`, cls: 'bad' });
  if (partial.length) items.push({ text: `${partial.length} sortie manquante : jour(s) ${partial.map(d => d.tag).join(', ')}`, cls: 'bad' });
  if (negatives.length) items.push({ text: `${negatives.length} jour(s) avec un manque d'heures`, cls: '' });
  if (absences.length) items.push({ text: `${absences.length} jour(s) d'absence enregistré(s) : ${absences.map(d => d.tag).join(', ')}`, cls: 'info' });
  if (leaves.length) items.push({ text: `${leaves.length} jour(s) de congé / férié / repos`, cls: 'info' });

  if (!items.length) {
    ul.innerHTML = '<li class="none">Aucune alerte ce mois-ci 👍</li>';
    return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    if (it.cls) li.classList.add(it.cls);
    li.textContent = it.text;
    ul.appendChild(li);
  }
}

// ---------- REGLAGES ----------

function updateCycleEndPreview() {
  const sd = parseInt(document.getElementById('set-cycle-start').value, 10) || 1;
  const endEl = document.getElementById('set-cycle-end');
  if (sd === 1) {
    endEl.value = 'dernier jour du mois';
  } else {
    endEl.value = `${sd - 1} du mois suivant`;
  }
}

function renderSettings() {
  document.getElementById('set-required').value = settings.requiredHours;

  const cycleSel = document.getElementById('set-cycle-start');
  if (!cycleSel.childElementCount) {
    let html = '';
    for (let d = 1; d <= 28; d++) html += `<option value="${d}">${d === 1 ? '1er (mois calendaire)' : d}</option>`;
    cycleSel.innerHTML = html;
    cycleSel.addEventListener('change', updateCycleEndPreview);
  }
  cycleSel.value = cycleStartDay();
  updateCycleEndPreview();

  const picker = document.getElementById('weekdayPicker');
  picker.innerHTML = '';
  WEEKDAYS_SHORT.forEach((label, dow) => {
    const btn = document.createElement('div');
    btn.className = 'wd' + (settings.offDays.includes(dow) ? ' selected' : '');
    btn.textContent = label;
    btn.dataset.dow = dow;
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
    picker.appendChild(btn);
  });
}

document.getElementById('set-save').addEventListener('click', () => {
  const req = parseFloat(document.getElementById('set-required').value) || 0;
  const offDays = [...document.querySelectorAll('#weekdayPicker .wd.selected')].map(el => parseInt(el.dataset.dow));
  let cs = parseInt(document.getElementById('set-cycle-start').value, 10) || 1;
  cs = Math.min(28, Math.max(1, cs));
  settings = { requiredHours: req, offDays, cycleStartDay: cs };
  saveSettings(settings);
  // recale les curseurs de période sur la période courante (le découpage a pu changer)
  histCursor = currentPeriodCursor();
  dashCursor = currentPeriodCursor();
  toast('Réglages enregistrés');
  renderToday();
  renderHistory();
  renderDashboard();
  updateTopBadge();
});

// ---------- export / import / reset ----------

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export').addEventListener('click', () => {
  const data = { settings, entries };
  download(`suivi-heures-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('Export JSON téléchargé');
});

document.getElementById('btn-export-csv').addEventListener('click', () => {
  const cumulMap = computeCumulationMap();
  const rows = [['DATE','CHECK IN','CHECK OUT','WORKING HOURS','REQUIRED HOURS','TIME DIFFERENCE','OVERTIME','EXIT PERMISSIONS','CUMULATION','NOTES','TYPE']];
  for (const e of sortedEntries()) {
    const c = computeEntry(e);
    rows.push([
      e.date, e.checkIn || '', e.checkOut || '',
      c.hasFullEntry ? fmtHM(c.workedMin) : '',
      fmtHM(c.requiredMin), fmtHM(c.diffMin, true), fmtHM(c.overtimeMin),
      fmtHM(c.permMin), fmtHM(cumulMap[e.id], true), (e.notes || '').replace(/;/g, ','),
      TYPE_INFO[e.type || 'normal'].label
    ]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  download(`suivi-heures-${todayStr()}.csv`, '﻿' + csv, 'text/csv');
  toast('Export CSV téléchargé');
});

document.getElementById('btn-import').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error('format invalide');
      if (!confirm('Importer remplacera toutes les données actuelles. Continuer ?')) return;
      entries = normalizeEntries(data.entries);
      settings = Object.assign(defaultSettings(), data.settings || {});
      saveEntries(entries);
      saveSettings(settings);
      histCursor = currentPeriodCursor();
      dashCursor = currentPeriodCursor();
      toast('Importation réussie');
      renderSettings();
      renderToday();
      updateTopBadge();
    } catch (e) {
      alert('Fichier invalide : ' + e.message);
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Supprimer définitivement toutes les journées enregistrées ?')) return;
  if (!confirm('Cette action est irréversible. Confirmer la suppression ?')) return;
  entries = [];
  saveEntries(entries);
  toast('Données réinitialisées');
  renderHistory();
  renderDashboard();
  renderToday();
  updateTopBadge();
});

// ---------- init ----------

updateTypeFieldsVisibility();
renderToday();
updateTopBadge();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- AUTH ----------
// Pas d'inscription libre : les comptes sont créés par invitation (Supabase Dashboard →
// Authentication → Users → Invite user). Le lien reçu par email connecte directement la
// personne puis on lui demande de choisir son mot de passe (voir authRedirectType plus haut).

const appRoot = document.getElementById('appRoot');
const authScreen = document.getElementById('authScreen');
const authSigninBlock = document.getElementById('authSigninBlock');
const authSetPasswordBlock = document.getElementById('authSetPasswordBlock');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authError = document.getElementById('authError');
const authSubmit = document.getElementById('authSubmit');
const setPasswordForm = document.getElementById('setPasswordForm');
const setpwPasswordInput = document.getElementById('setpw-password');
const setpwConfirmInput = document.getElementById('setpw-confirm');
const setpwError = document.getElementById('setpwError');
const setpwSubmit = document.getElementById('setpwSubmit');
const userEmailEl = document.getElementById('userEmail');
const btnLogout = document.getElementById('btn-logout');

authForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  authError.style.display = 'none';
  authSubmit.disabled = true;
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (err) {
    authError.textContent = err.message || 'Une erreur est survenue.';
    authError.style.display = 'block';
  } finally {
    authSubmit.disabled = false;
  }
});

setPasswordForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  setpwError.style.display = 'none';
  const pw = setpwPasswordInput.value;
  const confirm = setpwConfirmInput.value;
  if (pw !== confirm) {
    setpwError.textContent = 'Les deux mots de passe ne correspondent pas.';
    setpwError.style.display = 'block';
    return;
  }
  setpwSubmit.disabled = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) throw error;
    authRedirectType = null;
    // nettoie le #access_token=... de l'URL une fois le mot de passe posé
    history.replaceState(null, '', window.location.pathname + window.location.search);
    authSetPasswordBlock.classList.add('hidden');
    authSigninBlock.classList.remove('hidden');
    toast('Mot de passe défini ✅');
    await enterApp();
  } catch (err) {
    setpwError.textContent = err.message || 'Erreur lors de la mise à jour du mot de passe.';
    setpwError.style.display = 'block';
  } finally {
    setpwSubmit.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
});

function showSetPasswordScreen() {
  authScreen.classList.remove('hidden');
  appRoot.classList.add('hidden');
  authSigninBlock.classList.add('hidden');
  authSetPasswordBlock.classList.remove('hidden');
}

// synchronise depuis Supabase puis affiche l'app
async function enterApp() {
  try {
    await syncFromCloud();
  } catch (err) {
    console.error('Chargement cloud échoué', err);
    toast('⚠️ Impossible de charger vos données');
  }
  authScreen.classList.add('hidden');
  appRoot.classList.remove('hidden');
}

// recharge tout depuis Supabase et remplace l'état local + le cache
async function syncFromCloud() {
  const [entriesRes, settingsRes] = await Promise.all([
    supabaseClient.from('entries').select('*'),
    supabaseClient.from('settings').select('*').maybeSingle(),
  ]);
  if (entriesRes.error) throw entriesRes.error;
  if (settingsRes.error) throw settingsRes.error;

  entries = normalizeEntries((entriesRes.data || []).map(rowToEntry));
  lastSyncedEntryIds = new Set(entries.map(e => e.id));
  localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));

  if (settingsRes.data) {
    settings = Object.assign(defaultSettings(), rowToSettings(settingsRes.data));
  } else {
    // premier login : pas encore de ligne côté serveur -> on pousse les valeurs actuelles/par défaut
    settings = Object.assign(defaultSettings(), settings);
    await saveSettings(settings);
  }
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));

  histCursor = currentPeriodCursor();
  dashCursor = currentPeriodCursor();
  resetForm();
  renderToday();
  renderHistory();
  renderDashboard();
  renderSettings();
  updateTopBadge();
}

async function handleAuthChange(session) {
  if (session && session.user) {
    currentUser = session.user;
    userEmailEl.textContent = currentUser.email || '';

    // arrivée via un lien d'invitation (ou de réinitialisation) : on bloque sur
    // l'écran "choisissez votre mot de passe" avant de laisser entrer dans l'app
    if (authRedirectType === 'invite' || authRedirectType === 'recovery') {
      showSetPasswordScreen();
      return;
    }

    await enterApp();
  } else {
    currentUser = null;
    lastSyncedEntryIds = new Set();
    entries = [];
    settings = defaultSettings();
    localStorage.removeItem(STORAGE_ENTRIES);
    localStorage.removeItem(STORAGE_SETTINGS);
    appRoot.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authSetPasswordBlock.classList.add('hidden');
    authSigninBlock.classList.remove('hidden');
    authForm.reset();
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  handleAuthChange(session);
});
