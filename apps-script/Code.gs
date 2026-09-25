/**
 * Backend Google Sheets du parrainage (index.html).
 *
 * À coller dans un projet Apps Script lié à une feuille Google Sheets, puis à
 * déployer en « Application Web » (exécuter en tant que : moi, accès : tout le
 * monde). Voir README.md.
 *
 * Propriété de script conseillée : ADMIN_KEY, le code demandé aux organisateurs
 * pour voir les inscrits, régler le bot et enregistrer les binômes.
 */

var SHEET_STUDENTS = 'Etudiants';
var SHEET_PAIRS = 'Binomes';
var SHEET_SETTINGS = 'Reglages';
var STUDENT_COLS = ['id', 'createdAt', 'role', 'firstName', 'lastName', 'email', 'phone', 'school', 'level', 'program',
  'country', 'city', 'languages', 'interests', 'mode', 'capacity', 'notes'];
var LIST_COLS = ['languages', 'interests'];
var PAIR_COLS = ['id', 'parrainId', 'filleulId', 'score', 'createdAt'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  // Réglages publics : le formulaire en a besoin pour la liste des écoles.
  if (p.action === 'config') return json_({ ok: true, settings: readSettings_() });
  if (!checkKey_(p.key)) return json_({ ok: false, error: 'Code organisateur invalide' });
  return json_({
    ok: true,
    settings: readSettings_(),
    students: readRows_(SHEET_STUDENTS, STUDENT_COLS).map(parseStudent_),
    pairs: readRows_(SHEET_PAIRS, PAIR_COLS).map(function (x) { x.score = Number(x.score) || 0; return x; })
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'register') return json_(register_(body.data || {}));
    if (!checkKey_(body.key)) return json_({ ok: false, error: 'Code organisateur invalide' });
    switch (body.action) {
      case 'setPairs':
        writeRows_(SHEET_PAIRS, PAIR_COLS, body.pairs || []);
        return json_({ ok: true });
      case 'saveSettings':
        var sh = sheet_(SHEET_SETTINGS, ['settings']);
        sh.getRange(2, 1).setValue(JSON.stringify(body.settings || {}));
        return json_({ ok: true });
      case 'delete':
        var id = String(body.id);
        writeRows_(SHEET_STUDENTS, STUDENT_COLS, readRows_(SHEET_STUDENTS, STUDENT_COLS).filter(function (s) { return s.id !== id; }));
        writeRows_(SHEET_PAIRS, PAIR_COLS, readRows_(SHEET_PAIRS, PAIR_COLS).filter(function (x) { return x.parrainId !== id && x.filleulId !== id; }));
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: 'Action inconnue' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function register_(d) {
  var role = d.role === 'parrain' ? 'parrain' : 'filleul';
  var s = {};
  STUDENT_COLS.forEach(function (c) { s[c] = LIST_COLS.indexOf(c) !== -1 ? toList_(d[c]).join('; ') : clean_(d[c]); });
  s.id = Utilities.getUuid();
  s.createdAt = new Date().toISOString();
  s.role = role;
  s.email = s.email.toLowerCase();
  s.level = role === 'filleul' ? 'L1' : s.level;
  s.capacity = role === 'parrain' ? String(Math.min(3, Math.max(1, Number(d.capacity) || 1))) : '0';

  if (!s.firstName || !s.lastName || !s.email || !s.school) {
    return { ok: false, error: 'Champs obligatoires manquants' };
  }
  var dup = readRows_(SHEET_STUDENTS, STUDENT_COLS).some(function (x) {
    return x.email.toLowerCase() === s.email && x.role === s.role;
  });
  if (dup) return { ok: false, error: 'Cette adresse email est déjà inscrite avec ce rôle.' };

  sheet_(SHEET_STUDENTS, STUDENT_COLS).appendRow(STUDENT_COLS.map(function (c) { return s[c]; }));
  return { ok: true };
}

function readSettings_() {
  var sh = sheet_(SHEET_SETTINGS, ['settings']);
  var raw = sh.getLastRow() >= 2 ? String(sh.getRange(2, 1).getValue()) : '';
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

function parseStudent_(s) {
  s.capacity = Number(s.capacity) || 0;
  LIST_COLS.forEach(function (c) { s[c] = s[c] ? s[c].split(/\s*;\s*/) : []; });
  return s;
}

function checkKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
  return !expected || key === expected;
}

function toList_(v) {
  return (Array.isArray(v) ? v : []).map(clean_).filter(String).slice(0, 30);
}

function clean_(v) {
  return String(v == null ? '' : v).trim().slice(0, 500);
}

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    // Tout en texte : évite que Sheets transforme les téléphones ou les dates.
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRows_(name, cols) {
  var sh = sheet_(name, cols);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getValues().map(function (row) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = String(row[i]); });
    return o;
  });
}

function writeRows_(name, cols, rows) {
  var sh = sheet_(name, cols);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, cols.length).clearContent();
  if (!rows.length) return;
  var values = rows.map(function (r) {
    return cols.map(function (c) { return String(r[c] == null ? '' : r[c]); });
  });
  sh.getRange(2, 1, values.length, cols.length).setNumberFormat('@').setValues(values);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
