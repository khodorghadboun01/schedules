/* ===== Suivi Heures de Travail — localStorage (cache) + Supabase (cloud) + i18n ===== */

const STORAGE_ENTRIES = 'wh_entries_v1';
const STORAGE_SETTINGS = 'wh_settings_v1';
const STORAGE_CLOCK_OFFSET = 'wh_clock_offset_v1'; // décalage de l'horloge de l'appareil, en minutes (local, non synchronisé)

const SUPABASE_URL = 'https://hqwqplhmntxyxttuqqhi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd3FwbGhtbnR4eXh0dHVxcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MjY0NDEsImV4cCI6MjEwMzQwMjQ0MX0.fR6vAb7kkgZKx64TidHgbjhOxdDRNRf5VpW5N7Lvjr0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// lien d'invitation / réinitialisation Supabase : ?...#access_token=...&type=invite (ou "recovery")
// on le lit tout de suite, avant que quoi que ce soit ne touche au hash de l'URL
let authRedirectType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');

let currentUser = null;
let lastSyncedEntryIds = new Set(); // pour détecter les suppressions à synchroniser

// ================= I18N =================

const STORAGE_LANG = 'wh_lang_v1';
let lang = localStorage.getItem(STORAGE_LANG) === 'en' ? 'en' : 'fr';

const I18N = {
  fr: {
    page_title: 'Suivi Heures de Travail',
    app_title: 'Suivi Heures',
    auth_title: 'Connexion',
    auth_subtitle: 'Accès sur invitation uniquement.',
    auth_email: 'Email',
    auth_password: 'Mot de passe',
    auth_submit: 'Se connecter',
    auth_generic_error: 'Une erreur est survenue.',
    setpw_title: 'Bienvenue 👋',
    setpw_subtitle: 'Choisissez votre mot de passe pour activer votre compte.',
    setpw_new: 'Nouveau mot de passe',
    setpw_confirm: 'Confirmez le mot de passe',
    setpw_submit: 'Valider le mot de passe',
    setpw_mismatch: 'Les deux mots de passe ne correspondent pas.',
    setpw_error: 'Erreur lors de la mise à jour du mot de passe.',
    nav_saisie: 'Saisie',
    nav_historique: 'Historique',
    nav_dashboard: 'Dashboard',
    nav_reglages: 'Réglages',
    today_sub: "Aujourd'hui",
    toggle_manual_show: '📅 Ajouter ou corriger un autre jour ',
    toggle_manual_hide: '📅 Masquer la saisie manuelle ',
    form_title_new: 'Nouvelle journée',
    form_title_edit: 'Modifier la journée',
    label_date: 'Date',
    label_type: 'Type de journée',
    opt_normal: 'Normal (avec entrée / sortie)',
    opt_conge: '🌴 Congé',
    opt_ferie: '🎌 Jour férié',
    opt_repos: '🛌 Repos exceptionnel',
    opt_absence: '🚫 Absence',
    label_checkin: "Heure d'entrée (Check In)",
    label_checkout: 'Heure de sortie (Check Out)',
    label_required: 'Heures requises (h)',
    label_permission: 'Permissions de sortie (minutes)',
    label_notes: 'Notes',
    notes_placeholder: 'Retard justifié, mission, etc.',
    btn_save: 'Enregistrer',
    btn_update: 'Mettre à jour',
    btn_cancel_edit: 'Annuler la modification',
    day_off_rest: '😴 Jour de repos',
    chip_worked_today: "💼 J'ai travaillé aujourd'hui",
    absence_recorded: '🚫 Absence enregistrée',
    btn_back_normal: '↺ Revenir à une journée normale',
    btn_checkin: "Pointer l'arrivée",
    btn_checkout: 'Pointer la sortie',
    btn_cancel_checkin: "↺ Annuler l'arrivée",
    label_arrivee: 'Arrivée',
    label_sortie: 'Sortie',
    sg_worked: 'Travaillé',
    sg_required: 'Requis',
    sg_diff: 'Écart',
    sg_overtime: 'Supplémentaire',
    btn_edit_perm_notes: '✎ Modifier / permission / notes',
    btn_reset_day: '↺ Réinitialiser la journée',
    btn_validate: '✓ Valider',
    btn_cancel: 'Annuler',
    invalid_time: 'Heure invalide',
    time_updated: 'Heure mise à jour',
    lbl_type_cap: 'Type',
    lbl_required_hours_inline: 'heures requises',
    lbl_net_day_inline: 'net du jour',
    lbl_required_hours_cap: 'Heures requises',
    msg_fill_checkin_checkout: "renseignez l'entrée et la sortie pour voir le calcul complet.",
    lbl_permission_cap: 'Permission',
    lbl_net_day_cap: 'Net du jour',
    toast_checkin: 'Arrivée enregistrée à ',
    toast_checkout: 'Sortie enregistrée à ',
    toast_day_marked: 'Journée marquée : ',
    toast_choose_date: 'Choisissez une date',
    toast_day_updated: 'Journée modifiée',
    toast_day_updated_existing: 'Journée mise à jour (date existante)',
    toast_day_saved: 'Journée enregistrée',
    toast_day_deleted: 'Journée supprimée',
    toast_settings_saved: 'Réglages enregistrés',
    toast_export_json: 'Export JSON téléchargé',
    toast_export_csv: 'Export CSV téléchargé',
    toast_import_success: 'Importation réussie',
    toast_reset_done: 'Données réinitialisées',
    toast_password_set: 'Mot de passe défini ✅',
    toast_sync_error: '⚠️ Erreur de synchronisation',
    toast_sync_error_settings: '⚠️ Erreur de synchronisation des réglages',
    toast_load_error: '⚠️ Impossible de charger vos données',
    confirm_reset_day: 'Réinitialiser les heures de la journée ?',
    confirm_delete_day: 'Supprimer cette journée ?',
    confirm_import: 'Importer remplacera toutes les données actuelles. Continuer ?',
    confirm_reset_all_1: 'Supprimer définitivement toutes les journées enregistrées ?',
    confirm_reset_all_2: 'Cette action est irréversible. Confirmer la suppression ?',
    alert_invalid_file: 'Fichier invalide : ',
    delete_title: 'Supprimer',
    hist_empty: "Aucune entrée pour ce mois. Ajoutez-en une dans l'onglet Saisie, ou touchez un jour dans le Dashboard.",
    day_notpunched: 'Non pointé',
    day_inprogress: 'en cours',
    top_cumul_prefix: 'Cumul : ',
    cumul_label: 'Cumul',
    dash_progress: 'Progression du mois',
    stat_worked: 'Heures travaillées',
    stat_required: 'Heures requises',
    stat_overtime: 'Heures supplémentaires',
    stat_diff: 'Écart du mois',
    stat_perm: 'Permissions cumulées',
    stat_cumul: 'Cumul fin de mois',
    cal_title: 'Calendrier du mois',
    legend_ok: 'jour complet',
    legend_warn: "manque d'heures",
    legend_off: 'repos',
    legend_leave: 'congé / férié',
    legend_miss: 'absence / non pointé',
    cal_hint: "Touchez un jour pour l'ouvrir ou en ajouter un.",
    alerts_title: 'Alertes',
    account_title: 'Compte',
    logout_btn: 'Se déconnecter',
    settings_title: 'Réglages',
    label_default_required: 'Heures requises par défaut (jour travaillé)',
    cycle_title: 'Cycle mensuel (période de paie)',
    cycle_desc: "Dans l'entreprise, le mois ne va pas du 1er au 30. Indiquez le jour où commence le cycle : la période ira de ce jour au même jour (–1) du mois suivant. Ex. : 26 → chaque mois va du 26 au 25 du mois d'après. Mettez 1 pour un mois calendaire classique.",
    label_cycle_start: 'Le cycle commence le',
    opt_cycle_calendar: '1er (mois calendaire)',
    label_cycle_end: 'Le cycle se termine le',
    cycle_end_last_day: 'dernier jour du mois',
    offdays_title: 'Jours non travaillés par défaut',
    btn_save_settings: 'Enregistrer les réglages',
    backup_title: 'Sauvegarde des données',
    backup_desc: 'Vos données sont synchronisées avec votre compte en ligne. Exportez régulièrement une sauvegarde par précaution.',
    btn_export_json: 'Exporter (JSON)',
    btn_export_csv: 'Exporter (CSV)',
    btn_import_json: 'Importer (JSON)',
    btn_reset_all: 'Réinitialiser toutes les données',
    reset_confirm_title: 'Confirmer la réinitialisation',
    reset_confirm_desc: 'Cette action supprime définitivement toutes vos journées enregistrées. Entrez votre mot de passe pour confirmer.',
    wrong_password: 'Mot de passe incorrect.',
    clock_title: "Horloge de l'appareil",
    clock_desc: "Si l'horloge de cet appareil n'est pas exactement à l'heure, indiquez l'écart en minutes : positif si l'appareil retarde, négatif s'il avance. Le pointage Arrivée / Sortie sera enregistré à l'heure corrigée. Ajustez la valeur jusqu'à ce que « heure corrigée » corresponde à l'heure réelle. Ce réglage reste sur cet appareil et n'est pas synchronisé.",
    clock_offset_label: "Écart en minutes (+ retard / – avance)",
    clock_device_now: "Heure de l'appareil",
    clock_corrected_now: 'Heure corrigée (utilisée au pointage)',
    lang_title: 'Langue',
    type_normal: 'Normal',
    type_conge: 'Congé',
    type_ferie: 'Férié',
    type_repos: 'Repos exceptionnel',
    type_absence: 'Absence',
  },
  en: {
    page_title: 'Work Hours Tracker',
    app_title: 'Time Tracking',
    auth_title: 'Sign in',
    auth_subtitle: 'Invite-only access.',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_submit: 'Sign in',
    auth_generic_error: 'An error occurred.',
    setpw_title: 'Welcome 👋',
    setpw_subtitle: 'Choose your password to activate your account.',
    setpw_new: 'New password',
    setpw_confirm: 'Confirm password',
    setpw_submit: 'Set password',
    setpw_mismatch: 'The two passwords do not match.',
    setpw_error: 'Error updating the password.',
    nav_saisie: 'Entry',
    nav_historique: 'History',
    nav_dashboard: 'Dashboard',
    nav_reglages: 'Settings',
    today_sub: 'Today',
    toggle_manual_show: '📅 Add or fix another day ',
    toggle_manual_hide: '📅 Hide manual entry ',
    form_title_new: 'New day',
    form_title_edit: 'Edit day',
    label_date: 'Date',
    label_type: 'Day type',
    opt_normal: 'Normal (check-in / check-out)',
    opt_conge: '🌴 Leave',
    opt_ferie: '🎌 Public holiday',
    opt_repos: '🛌 Exceptional day off',
    opt_absence: '🚫 Absence',
    label_checkin: 'Check-in time',
    label_checkout: 'Check-out time',
    label_required: 'Required hours (h)',
    label_permission: 'Exit permissions (minutes)',
    label_notes: 'Notes',
    notes_placeholder: 'Justified delay, mission, etc.',
    btn_save: 'Save',
    btn_update: 'Update',
    btn_cancel_edit: 'Cancel edit',
    day_off_rest: '😴 Day off',
    chip_worked_today: '💼 I worked today',
    absence_recorded: '🚫 Absence recorded',
    btn_back_normal: '↺ Back to a normal day',
    btn_checkin: 'Check in',
    btn_checkout: 'Check out',
    btn_cancel_checkin: '↺ Cancel check-in',
    label_arrivee: 'Check-in',
    label_sortie: 'Check-out',
    sg_worked: 'Worked',
    sg_required: 'Required',
    sg_diff: 'Difference',
    sg_overtime: 'Overtime',
    btn_edit_perm_notes: '✎ Edit / permission / notes',
    btn_reset_day: '↺ Reset the day',
    btn_validate: '✓ Confirm',
    btn_cancel: 'Cancel',
    invalid_time: 'Invalid time',
    time_updated: 'Time updated',
    lbl_type_cap: 'Type',
    lbl_required_hours_inline: 'required hours',
    lbl_net_day_inline: 'net for the day',
    lbl_required_hours_cap: 'Required hours',
    msg_fill_checkin_checkout: 'fill in check-in and check-out to see the full calculation.',
    lbl_permission_cap: 'Permission',
    lbl_net_day_cap: 'Net for the day',
    toast_checkin: 'Check-in recorded at ',
    toast_checkout: 'Check-out recorded at ',
    toast_day_marked: 'Day marked: ',
    toast_choose_date: 'Choose a date',
    toast_day_updated: 'Day updated',
    toast_day_updated_existing: 'Day updated (existing date)',
    toast_day_saved: 'Day saved',
    toast_day_deleted: 'Day deleted',
    toast_settings_saved: 'Settings saved',
    toast_export_json: 'JSON export downloaded',
    toast_export_csv: 'CSV export downloaded',
    toast_import_success: 'Import successful',
    toast_reset_done: 'Data reset',
    toast_password_set: 'Password set ✅',
    toast_sync_error: '⚠️ Sync error',
    toast_sync_error_settings: '⚠️ Settings sync error',
    toast_load_error: '⚠️ Unable to load your data',
    confirm_reset_day: 'Reset the hours for this day?',
    confirm_delete_day: 'Delete this day?',
    confirm_import: 'Importing will replace all current data. Continue?',
    confirm_reset_all_1: 'Permanently delete all recorded days?',
    confirm_reset_all_2: 'This action is irreversible. Confirm deletion?',
    alert_invalid_file: 'Invalid file: ',
    delete_title: 'Delete',
    hist_empty: 'No entries for this month. Add one in the Entry tab, or tap a day in the Dashboard.',
    day_notpunched: 'Not clocked',
    day_inprogress: 'in progress',
    top_cumul_prefix: 'Balance: ',
    cumul_label: 'Balance',
    dash_progress: 'Progress this month',
    stat_worked: 'Hours worked',
    stat_required: 'Hours required',
    stat_overtime: 'Overtime hours',
    stat_diff: 'Difference this month',
    stat_perm: 'Accumulated permissions',
    stat_cumul: 'End-of-month balance',
    cal_title: 'Month calendar',
    legend_ok: 'full day',
    legend_warn: 'missing hours',
    legend_off: 'day off',
    legend_leave: 'leave / holiday',
    legend_miss: 'absence / not clocked',
    cal_hint: 'Tap a day to open it or add one.',
    alerts_title: 'Alerts',
    account_title: 'Account',
    logout_btn: 'Log out',
    settings_title: 'Settings',
    label_default_required: 'Default required hours (working day)',
    cycle_title: 'Monthly cycle (pay period)',
    cycle_desc: "At the company, the month doesn't run from the 1st to the 30th. Enter the day the cycle starts: the period will run from that day to the same day (–1) of the following month. E.g.: 26 → each month runs from the 26th to the 25th of the next month. Set 1 for a standard calendar month.",
    label_cycle_start: 'The cycle starts on',
    opt_cycle_calendar: '1st (calendar month)',
    label_cycle_end: 'The cycle ends on',
    cycle_end_last_day: 'last day of the month',
    offdays_title: 'Default non-working days',
    btn_save_settings: 'Save settings',
    backup_title: 'Data backup',
    backup_desc: 'Your data is synced with your online account. Export a backup regularly as a precaution.',
    btn_export_json: 'Export (JSON)',
    btn_export_csv: 'Export (CSV)',
    btn_import_json: 'Import (JSON)',
    btn_reset_all: 'Reset all data',
    reset_confirm_title: 'Confirm reset',
    reset_confirm_desc: 'This action permanently deletes all your recorded days. Enter your password to confirm.',
    wrong_password: 'Incorrect password.',
    clock_title: 'Device clock',
    clock_desc: "If this device's clock isn't exactly on time, enter the offset in minutes: positive if the device is slow, negative if it's fast. Check-in / check-out will be recorded at the corrected time. Adjust the value until “corrected time” matches the real time. This setting stays on this device and is not synced.",
    clock_offset_label: 'Offset in minutes (+ slow / – fast)',
    clock_device_now: 'Device time',
    clock_corrected_now: 'Corrected time (used when clocking)',
    lang_title: 'Language',
    type_normal: 'Normal',
    type_conge: 'Leave',
    type_ferie: 'Holiday',
    type_repos: 'Exceptional day off',
    type_absence: 'Absence',
  },
};

function t(key) {
  return (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : (I18N.fr[key] || key);
}

const WEEKDAYS_MAP = {
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const WEEKDAYS_SHORT_MAP = {
  fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};
const MONTHS_MAP = {
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT_MAP = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function weekdaysFull() { return WEEKDAYS_MAP[lang]; }
function weekdaysShort() { return WEEKDAYS_SHORT_MAP[lang]; }
function monthsFull() { return MONTHS_MAP[lang]; }
function monthsShort() { return MONTHS_SHORT_MAP[lang]; }

const TYPE_ICONS = { normal: '', conge: '🌴', ferie: '🎌', repos: '🛌', absence: '🚫' };
function typeIcon(type) { return TYPE_ICONS[type] || ''; }
function typeLabel(type) { return t('type_' + type); }

// remplace le noeud texte direct d'un élément (préserve ses éventuels enfants HTML)
function setI18nText(el, key) {
  const text = t(key);
  const node = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
  if (node) node.nodeValue = text;
  else el.insertBefore(document.createTextNode(text), el.firstChild);
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => setI18nText(el, el.dataset.i18n));
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = lang;
  document.title = t('page_title');
}

applyStaticTranslations();

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
    toast(t('toast_sync_error_settings'));
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
    toast(t('toast_sync_error'));
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

// décalage (en minutes) entre l'horloge de cet appareil et l'heure réelle
// > 0 : l'appareil retarde ; < 0 : l'appareil avance. Stocké localement, jamais synchronisé.
function clockOffsetMin() {
  const v = parseInt(localStorage.getItem(STORAGE_CLOCK_OFFSET), 10);
  if (!Number.isFinite(v)) return 0;
  return Math.min(720, Math.max(-720, v));
}

// "maintenant" corrigé du décalage d'horloge de l'appareil
function correctedNow() {
  return new Date(Date.now() + clockOffsetMin() * 60000);
}

function todayStr() {
  const d = correctedNow();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function nowHM() {
  const d = correctedNow();
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
  return `${weekdaysFull()[dow]} ${d} ${monthsFull()[m - 1]}`;
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
    return `${monthsFull()[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const left = `${start.getDate()} ${monthsShort()[start.getMonth()]}${sameYear ? '' : ' ' + start.getFullYear()}`;
  const right = `${end.getDate()} ${monthsShort()[end.getMonth()]} ${end.getFullYear()}`;
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
    <div class="today-sub">${t('today_sub')}</div>`;

  // jour de repos implicite (weekend), rien d'enregistré
  if (type === 'off-implicit') {
    card.innerHTML = head + `
      <div class="statusBadge off">${t('day_off_rest')}</div>
      <div class="chipRow">
        <button class="chip" onclick="quickForceWork()">${t('chip_worked_today')}</button>
        <button class="chip" onclick="quickSetType('conge')">${typeIcon('conge')} ${typeLabel('conge')}</button>
        <button class="chip" onclick="quickSetType('absence')">${typeIcon('absence')} ${typeLabel('absence')}</button>
      </div>`;
    return;
  }

  // congé / férié / repos exceptionnel explicitement marqué
  if (type === 'conge' || type === 'ferie' || type === 'repos') {
    card.innerHTML = head + `
      <div class="statusBadge leave">${typeIcon(type)} ${typeLabel(type)}</div>
      <button class="smallLink" onclick="quickResetToday()">${t('btn_back_normal')}</button>`;
    return;
  }

  // absence explicite
  if (type === 'absence') {
    card.innerHTML = head + `
      <div class="statusBadge absence">${t('absence_recorded')}</div>
      <button class="smallLink" onclick="quickResetToday()">${t('btn_back_normal')}</button>`;
    return;
  }

  // journée normale : pas encore de check-in
  if (!entry || !entry.checkIn) {
    card.innerHTML = head + `
      <button class="bigAction checkin" onclick="quickCheckIn()"><span class="ic">🟢</span> ${t('btn_checkin')}</button>
      <div class="chipRow">
        <button class="chip" onclick="quickSetType('conge')">${typeIcon('conge')} ${typeLabel('conge')}</button>
        <button class="chip" onclick="quickSetType('ferie')">${typeIcon('ferie')} ${typeLabel('ferie')}</button>
        <button class="chip" onclick="quickSetType('repos')">${typeIcon('repos')} ${typeLabel('repos')}</button>
        <button class="chip" onclick="quickSetType('absence')">${typeIcon('absence')} ${typeLabel('absence')}</button>
      </div>`;
    return;
  }

  // check-in fait, pas encore de check-out
  if (entry.checkIn && !entry.checkOut) {
    card.innerHTML = head + renderTimePill('checkIn', entry.checkIn, t('label_arrivee')) + `
      <button class="bigAction checkout" onclick="quickCheckOut()"><span class="ic">🔴</span> ${t('btn_checkout')}</button>
      <button class="smallLink danger" onclick="quickResetToday()">${t('btn_cancel_checkin')}</button>`;
    return;
  }

  // journée complète : résumé
  const c = computeEntry(entry);
  card.innerHTML = head +
    renderTimePill('checkIn', entry.checkIn, t('label_arrivee')) +
    renderTimePill('checkOut', entry.checkOut, t('label_sortie')) +
    `<div class="summaryGrid">
      <div class="mini"><div class="ml">${t('sg_worked')}</div><div class="mv">${fmtHM(c.workedMin)}</div></div>
      <div class="mini"><div class="ml">${t('sg_required')}</div><div class="mv">${fmtHM(c.requiredMin)}</div></div>
      <div class="mini"><div class="ml">${t('sg_diff')}</div><div class="mv ${c.diffMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.diffMin, true)}</div></div>
      <div class="mini"><div class="ml">${t('sg_overtime')}</div><div class="mv">${fmtHM(c.overtimeMin)}</div></div>
    </div>
    <div class="rowActions">
      <button class="smallLink" onclick="openManualEdit('${entry.id}')">${t('btn_edit_perm_notes')}</button>
      <button class="smallLink danger" onclick="quickResetToday()">${t('btn_reset_day')}</button>
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
        <button class="btn primary" style="padding:9px" onclick="saveEditTime('${field}')">${t('btn_validate')}</button>
        <button class="btn ghost" style="padding:9px" onclick="cancelEditTime()">${t('btn_cancel')}</button>
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
  const tm = nowHM();
  upsertEntryForDate(todayStr(), { checkIn: tm, type: 'normal' });
  toast(t('toast_checkin') + tm);
  renderToday();
  refreshAll();
}

function quickCheckOut() {
  const tm = nowHM();
  upsertEntryForDate(todayStr(), { checkOut: tm });
  toast(t('toast_checkout') + tm);
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
  toast(t('toast_day_marked') + typeLabel(type));
  renderToday();
  refreshAll();
}

function quickResetToday() {
  const dateStr = todayStr();
  const e = entryForDate(dateStr);
  if (e && e.checkIn && e.checkOut) {
    if (!confirm(t('confirm_reset_day'))) return;
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
  if (!hEl || !mEl) { toast(t('invalid_time')); return; }
  upsertEntryForDate(todayStr(), { [field]: hEl.value + ':' + mEl.value });
  todayEditingField = null;
  toast(t('time_updated'));
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
  manualToggleBtn.firstChild.textContent = visible ? t('toggle_manual_hide') : t('toggle_manual_show');
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
  f.daybadge.textContent = weekdaysFull()[dow] + (off ? ' · ' + (lang === 'fr' ? 'jour non travaillé' : 'non-working day') : '');
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
    f.preview.innerHTML = `${t('lbl_type_cap')} : <b>${typeIcon(f.type.value)} ${typeLabel(f.type.value)}</b> — ${t('lbl_required_hours_inline')} : <b>${fmtHM(c.requiredMin)}</b>, ${t('lbl_net_day_inline')} : <b class="${c.netMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.netMin, true)}</b>`;
    return;
  }
  if (!c.hasFullEntry) {
    f.preview.innerHTML = `${t('lbl_required_hours_cap')} : <b>${fmtHM(c.requiredMin)}</b> — ${t('msg_fill_checkin_checkout')}`;
    return;
  }
  f.preview.innerHTML =
    `${t('sg_worked')} : <b>${fmtHM(c.workedMin)}</b> &nbsp;·&nbsp; ${t('sg_required')} : <b>${fmtHM(c.requiredMin)}</b><br>` +
    `${t('sg_diff')} : <b class="${c.diffMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.diffMin, true)}</b> &nbsp;·&nbsp; ${t('sg_overtime')} : <b>${fmtHM(c.overtimeMin)}</b><br>` +
    `${t('lbl_permission_cap')} : <b>${fmtHM(c.permMin)}</b> &nbsp;·&nbsp; ${t('lbl_net_day_cap')} : <b class="${c.netMin >= 0 ? 'pos' : 'neg'}">${fmtHM(c.netMin, true)}</b>`;
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
  if (!entry.date) { toast(t('toast_choose_date')); return; }

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx >= 0) entries[idx] = entry;
    toast(t('toast_day_updated'));
  } else {
    const existing = entries.findIndex(e => e.date === entry.date);
    if (existing >= 0) {
      entries[existing] = entry;
      toast(t('toast_day_updated_existing'));
    } else {
      entries.push(entry);
      toast(t('toast_day_saved'));
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
  document.getElementById('formTitle').textContent = t('form_title_new');
  f.submit.textContent = t('btn_save');
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
  document.getElementById('formTitle').textContent = t('form_title_edit');
  f.submit.textContent = t('btn_update');
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
  if (!confirm(t('confirm_delete_day'))) return;
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  renderHistory();
  renderDashboard();
  if (entryForDate(todayStr()) === undefined) renderToday();
  updateTopBadge();
  toast(t('toast_day_deleted'));
}

// ---------- top badge ----------

function updateTopBadge() {
  const map = computeCumulationMap();
  const list = sortedEntries();
  const last = list[list.length - 1];
  const val = last ? map[last.id] : 0;
  const el = document.getElementById('topCumul');
  el.textContent = t('top_cumul_prefix') + fmtHM(val, true);
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
    <div class="chipStat"><div class="csl">${t('sg_worked')}</div><div class="csv">${fmtHM(worked)}</div></div>
    <div class="chipStat"><div class="csl">${t('sg_required')}</div><div class="csv">${fmtHM(required)}</div></div>
    <div class="chipStat"><div class="csl">${t('sg_diff')}</div><div class="csv ${diff >= 0 ? 'pos' : 'neg'}">${fmtHM(diff, true)}</div></div>`;

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
      title = `${typeIcon(type)} ${typeLabel(type)}`;
      sub = e.notes || '';
    } else {
      title = c.hasFullEntry ? `${e.checkIn} → ${e.checkOut}` : (e.checkIn ? `${e.checkIn} → ${t('day_inprogress')}` : t('day_notpunched'));
      sub = [c.hasFullEntry ? `${t('sg_worked')} ${fmtHM(c.workedMin)}` : '', e.notes].filter(Boolean).join(' · ');
    }

    const row = document.createElement('div');
    row.className = 'dayRow status-' + statusClass;
    row.innerHTML = `
      <div class="dateBlock"><div class="dnum">${d}</div><div class="ddow">${weekdaysShort()[dow]}</div></div>
      <div class="dayInfo"><div class="dTitle">${escapeHtml(title)}</div><div class="dSub">${escapeHtml(sub)}</div></div>
      <div class="dayRight">
        <div class="dPill ${c.netMin >= 0 ? 'pillPos' : 'pillNeg'}">${fmtHM(c.netMin, true)}</div>
        <div class="dCumul">${t('cumul_label')} ${fmtHM(cumulMap[e.id], true)}</div>
      </div>
      <button class="dayDelete" title="${t('delete_title')}">✕</button>`;
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
  weekdaysEl.innerHTML = weekdaysShort().slice(1).concat(weekdaysShort()[0]).map(d => `<div>${d}</div>`).join('');

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
    const icon = d.type ? typeIcon(d.type) : '';
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
  document.getElementById('formTitle').textContent = t('form_title_new');
  f.submit.textContent = t('btn_save');
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
  if (missing.length) {
    const tags = missing.map(d => d.tag).join(', ');
    items.push({ text: lang === 'fr' ? `${missing.length} jour(s) sans pointage : ${tags}` : `${missing.length} day(s) without clock-in: ${tags}`, cls: 'bad' });
  }
  if (partial.length) {
    const tags = partial.map(d => d.tag).join(', ');
    items.push({ text: lang === 'fr' ? `${partial.length} sortie manquante : jour(s) ${tags}` : `${partial.length} missing check-out: day(s) ${tags}`, cls: 'bad' });
  }
  if (negatives.length) {
    items.push({ text: lang === 'fr' ? `${negatives.length} jour(s) avec un manque d'heures` : `${negatives.length} day(s) with missing hours`, cls: '' });
  }
  if (absences.length) {
    const tags = absences.map(d => d.tag).join(', ');
    items.push({ text: lang === 'fr' ? `${absences.length} jour(s) d'absence enregistré(s) : ${tags}` : `${absences.length} recorded absence day(s): ${tags}`, cls: 'info' });
  }
  if (leaves.length) {
    items.push({ text: lang === 'fr' ? `${leaves.length} jour(s) de congé / férié / repos` : `${leaves.length} leave / holiday / day-off day(s)`, cls: 'info' });
  }

  if (!items.length) {
    ul.innerHTML = `<li class="none">${lang === 'fr' ? 'Aucune alerte ce mois-ci 👍' : 'No alerts this month 👍'}</li>`;
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
    endEl.value = t('cycle_end_last_day');
  } else {
    endEl.value = lang === 'fr' ? `${sd - 1} du mois suivant` : `Day ${sd - 1} of the following month`;
  }
}

function updateClockPreview() {
  const el = document.getElementById('set-clock-preview');
  if (!el) return;
  const raw = parseInt(document.getElementById('set-clock-offset').value, 10);
  const off = Number.isFinite(raw) ? Math.min(720, Math.max(-720, raw)) : 0;
  const dev = new Date();
  const cor = new Date(dev.getTime() + off * 60000);
  const hms = d => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  el.innerHTML = `${t('clock_device_now')} : <b>${hms(dev)}</b><br>${t('clock_corrected_now')} : <b>${hms(cor)}</b>`;
}

// horloge qui avance : garde l'aperçu à jour tant qu'on est dans les Réglages
setInterval(() => {
  const v = document.getElementById('view-reglages');
  if (v && v.classList.contains('active')) updateClockPreview();
}, 1000);

function renderSettings() {
  document.getElementById('set-required').value = settings.requiredHours;
  document.getElementById('set-clock-offset').value = clockOffsetMin();
  updateClockPreview();

  const cycleSel = document.getElementById('set-cycle-start');
  let html = '';
  for (let d = 1; d <= 28; d++) html += `<option value="${d}">${d === 1 ? t('opt_cycle_calendar') : d}</option>`;
  cycleSel.innerHTML = html;
  cycleSel.value = cycleStartDay();
  updateCycleEndPreview();

  const picker = document.getElementById('weekdayPicker');
  picker.innerHTML = '';
  weekdaysShort().forEach((label, dow) => {
    const btn = document.createElement('div');
    btn.className = 'wd' + (settings.offDays.includes(dow) ? ' selected' : '');
    btn.textContent = label;
    btn.dataset.dow = dow;
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
    picker.appendChild(btn);
  });

  updateLangButtons();
}

document.getElementById('set-cycle-start').addEventListener('change', updateCycleEndPreview);
document.getElementById('set-clock-offset').addEventListener('input', updateClockPreview);

document.getElementById('set-save').addEventListener('click', () => {
  const req = parseFloat(document.getElementById('set-required').value) || 0;
  const offDays = [...document.querySelectorAll('#weekdayPicker .wd.selected')].map(el => parseInt(el.dataset.dow));
  let cs = parseInt(document.getElementById('set-cycle-start').value, 10) || 1;
  cs = Math.min(28, Math.max(1, cs));
  settings = { requiredHours: req, offDays, cycleStartDay: cs };
  saveSettings(settings);
  // décalage d'horloge : local à l'appareil, jamais synchronisé ni exporté
  const clkRaw = parseInt(document.getElementById('set-clock-offset').value, 10);
  localStorage.setItem(STORAGE_CLOCK_OFFSET, String(Number.isFinite(clkRaw) ? Math.min(720, Math.max(-720, clkRaw)) : 0));
  // recale les curseurs de période sur la période courante (le découpage a pu changer)
  histCursor = currentPeriodCursor();
  dashCursor = currentPeriodCursor();
  toast(t('toast_settings_saved'));
  renderToday();
  renderHistory();
  renderDashboard();
  updateTopBadge();
});

// ---------- langue ----------

const langButtons = document.querySelectorAll('.langBtn');

function updateLangButtons() {
  langButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
}
updateLangButtons();

function setLanguage(newLang) {
  if (newLang !== 'fr' && newLang !== 'en') return;
  if (newLang === lang) return;
  lang = newLang;
  localStorage.setItem(STORAGE_LANG, lang);
  applyStaticTranslations();
  updateLangButtons();
  document.getElementById('formTitle').textContent = editingId ? t('form_title_edit') : t('form_title_new');
  f.submit.textContent = editingId ? t('btn_update') : t('btn_save');
  setManualFormVisible(manualCard.style.display !== 'none');
  updateDayBadge();
  updateTypeFieldsVisibility();
  updatePreview();
  renderToday();
  renderHistory();
  renderDashboard();
  renderSettings();
  updateTopBadge();
}

langButtons.forEach(btn => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
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
  toast(t('toast_export_json'));
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
      typeLabel(e.type || 'normal')
    ]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  download(`suivi-heures-${todayStr()}.csv`, '﻿' + csv, 'text/csv');
  toast(t('toast_export_csv'));
});

document.getElementById('btn-import').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error('format invalide');
      if (!confirm(t('confirm_import'))) return;
      entries = normalizeEntries(data.entries);
      settings = Object.assign(defaultSettings(), data.settings || {});
      saveEntries(entries);
      saveSettings(settings);
      histCursor = currentPeriodCursor();
      dashCursor = currentPeriodCursor();
      toast(t('toast_import_success'));
      renderSettings();
      renderToday();
      updateTopBadge();
    } catch (e) {
      alert(t('alert_invalid_file') + e.message);
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

// réinitialisation des données : confirmée par re-saisie du mot de passe (pas de simple confirm())
const resetConfirmModal = document.getElementById('resetConfirmModal');
const resetConfirmForm = document.getElementById('resetConfirmForm');
const resetConfirmPassword = document.getElementById('resetConfirmPassword');
const resetConfirmError = document.getElementById('resetConfirmError');
const resetConfirmSubmit = document.getElementById('resetConfirmSubmit');
const resetConfirmCancel = document.getElementById('resetConfirmCancel');

document.getElementById('btn-reset').addEventListener('click', () => {
  resetConfirmPassword.value = '';
  resetConfirmError.style.display = 'none';
  resetConfirmModal.classList.remove('hidden');
  setTimeout(() => resetConfirmPassword.focus(), 0);
});

resetConfirmCancel.addEventListener('click', () => {
  resetConfirmModal.classList.add('hidden');
});

resetConfirmForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  resetConfirmError.style.display = 'none';
  resetConfirmSubmit.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: currentUser.email,
      password: resetConfirmPassword.value,
    });
    if (error) throw error;

    resetConfirmModal.classList.add('hidden');
    entries = [];
    saveEntries(entries);
    toast(t('toast_reset_done'));
    renderHistory();
    renderDashboard();
    renderToday();
    updateTopBadge();
  } catch (err) {
    resetConfirmError.textContent = t('wrong_password');
    resetConfirmError.style.display = 'block';
  } finally {
    resetConfirmSubmit.disabled = false;
  }
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
const loadingScreen = document.getElementById('loadingScreen');
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
    authError.textContent = err.message || t('auth_generic_error');
    authError.style.display = 'block';
  } finally {
    authSubmit.disabled = false;
  }
});

setPasswordForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  setpwError.style.display = 'none';
  const pw = setpwPasswordInput.value;
  const confirmPw = setpwConfirmInput.value;
  if (pw !== confirmPw) {
    setpwError.textContent = t('setpw_mismatch');
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
    toast(t('toast_password_set'));
    await enterApp();
  } catch (err) {
    setpwError.textContent = err.message || t('setpw_error');
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
    toast(t('toast_load_error'));
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
  renderHistory();
  renderDashboard();
  renderSettings();
  switchView('saisie'); // toujours revenir sur Saisie à l'ouverture / reconnexion
}

async function handleAuthChange(session) {
  loadingScreen.classList.add('hidden'); // Supabase a répondu : on sait désormais quel écran montrer

  if (session && session.user) {
    // signInWithPassword() (ex: re-vérification avant reset) redéclenche cet événement même
    // pour l'utilisateur déjà connecté : si l'app est déjà affichée pour ce même compte,
    // c'est juste un rafraîchissement de session, inutile de tout recharger
    const alreadyInAppForSameUser = currentUser && currentUser.id === session.user.id && !appRoot.classList.contains('hidden');

    currentUser = session.user;
    userEmailEl.textContent = currentUser.email || '';

    if (alreadyInAppForSameUser) return;

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
