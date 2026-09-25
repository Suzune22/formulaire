/*
 * Bot d'appariement parrain / filleul.
 *
 * Utilisable dans le navigateur (window.Matching) et dans Node (require).
 * Chaque critère a une règle (ignoré, de préférence identique, de préférence
 * différent, obligatoirement identique) et un poids de 0 à 10. Le bot calcule
 * un score pour chaque couple parrain / filleul puis cherche la répartition
 * qui maximise le score total (algorithme hongrois), sans dépasser le nombre
 * de filleul·es accepté par chaque parrain.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matching = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CRITERIA = [
    { id: 'residence', short: 'Commune',   label: 'Commune de résidence à Abidjan', type: 'text', same: 'Même commune à Abidjan', diff: 'Communes différentes' },
    { id: 'region',    short: 'Région',    label: "Région d'origine",                type: 'text', same: 'Même région d\'origine', diff: 'Régions d\'origine différentes' },
    { id: 'city',      short: 'Ville',     label: "Ville d'origine",                 type: 'text', same: 'Même ville d\'origine',  diff: 'Villes d\'origine différentes' },
    { id: 'highschool', short: 'Lycée',    label: "Lycée d'origine",                 type: 'text', same: 'Même lycée',             diff: 'Lycées différents' },
    { id: 'bac',       short: 'BAC',       label: 'Série du BAC',                    type: 'text', same: 'Même série de BAC',      diff: 'Séries de BAC différentes' },
    { id: 'languages', short: 'Langues',   label: 'Langues parlées',                 type: 'list' },
    { id: 'interests', short: 'Intérêts',  label: "Centres d'intérêt",               type: 'list' },
    { id: 'mode',      short: 'Rencontre', label: 'Mode de rencontre',               type: 'mode', same: 'Rencontres compatibles', diff: 'Rencontres incompatibles' }
  ];

  var RULES = [
    { id: 'ignore',    label: 'Ignoré' },
    { id: 'same',      label: 'De préférence identique' },
    { id: 'different', label: 'De préférence différent' },
    { id: 'required',  label: 'Obligatoirement identique' }
  ];

  var DEFAULT_SETTINGS = {
    residence:  { rule: 'same', weight: 6 },
    region:     { rule: 'same', weight: 5 },
    city:       { rule: 'same', weight: 3 },
    highschool: { rule: 'same', weight: 4 },
    bac:        { rule: 'same', weight: 6 },
    languages:  { rule: 'same', weight: 2 },
    interests:  { rule: 'same', weight: 2 },
    mode:       { rule: 'same', weight: 2 }
  };

  // Au-delà, les éléments en commun d'une liste ne rapportent plus de points.
  var LIST_CAP = 3;
  // Coût d'un filleul laissé sans binôme : domine tout score réel.
  var UNMATCHED = 1e6;
  // Petite pénalité par place déjà occupée chez un parrain, pour répartir
  // les filleul·es avant de remplir un même parrain. Reste sous 1 point.
  var SLOT_PENALTY = 0.1;

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function asList(v) {
    if (Array.isArray(v)) return v;
    return v ? String(v).split(/\s*[;,]\s*/).filter(Boolean) : [];
  }

  function settingsWithDefaults(settings) {
    var out = {};
    CRITERIA.forEach(function (c) {
      var s = (settings && settings[c.id]) || {};
      var d = DEFAULT_SETTINGS[c.id];
      out[c.id] = {
        rule: RULES.some(function (r) { return r.id === s.rule; }) ? s.rule : d.rule,
        weight: isFinite(Number(s.weight)) && s.weight !== '' && s.weight != null ? Math.max(0, Math.min(10, Number(s.weight))) : d.weight
      };
    });
    return out;
  }

  // Renvoie { known, sim, common } : sim vaut 1/0 pour texte et mode,
  // le nombre d'éléments communs (plafonné) pour une liste.
  function similarity(c, a, b) {
    if (c.type === 'text') {
      var x = norm(a[c.id]), y = norm(b[c.id]);
      if (!x || !y) return { known: false, sim: 0 };
      return { known: true, sim: x === y ? 1 : 0 };
    }
    if (c.type === 'list') {
      var la = asList(a[c.id]), lb = asList(b[c.id]).map(norm);
      if (!la.length || !lb.length) return { known: false, sim: 0, common: [] };
      var common = la.filter(function (i) { return lb.indexOf(norm(i)) !== -1; });
      return { known: true, sim: Math.min(LIST_CAP, common.length), common: common };
    }
    var ma = a.mode || 'les-deux', mb = b.mode || 'les-deux';
    return { known: true, sim: (ma === mb || ma === 'les-deux' || mb === 'les-deux') ? 1 : 0 };
  }

  // Score d'un couple parrain / filleul avec le détail des points.
  function score(parrain, filleul, settings) {
    var st = settingsWithDefaults(settings);
    var total = 0, ok = true, reasons = [], blockers = [];
    CRITERIA.forEach(function (c) {
      var rule = st[c.id].rule, w = st[c.id].weight;
      if (rule === 'ignore') return;
      var s = similarity(c, parrain, filleul);
      var pts = 0;
      if (rule === 'required') {
        if (!s.known || s.sim === 0) { ok = false; blockers.push(c.label); return; }
        pts = w * s.sim;
      } else if (!s.known) {
        return;
      } else if (rule === 'same') {
        pts = w * s.sim;
      } else {
        pts = s.sim === 0 ? w : (c.type === 'list' ? -w * s.sim : 0);
      }
      if (c.type === 'list') {
        if (rule === 'different' && s.sim === 0) reasons.push({ label: c.label + ' différents', points: pts });
        (s.common || []).forEach(function (i, idx) {
          reasons.push({ label: i, points: idx < LIST_CAP ? (rule === 'different' ? -w : w) : 0 });
        });
      } else if (s.sim === 1 && rule !== 'different') {
        reasons.push({ label: c.same, points: pts });
      } else if (s.sim === 0 && rule === 'different') {
        reasons.push({ label: c.diff, points: pts });
      } else if (s.sim === 0 && c.type === 'mode') {
        reasons.push({ label: c.diff, points: 0 });
      }
      total += pts;
    });
    return { score: Math.round(total * 10) / 10, ok: ok, reasons: reasons, blockers: blockers };
  }

  function capacityOf(p) {
    return Math.max(1, Math.min(10, Number(p.capacity) || 1));
  }

  // Algorithme hongrois : affectation de coût minimal pour une matrice carrée.
  // Renvoie assign[ligne] = colonne.
  function hungarian(cost) {
    var n = cost.length;
    var u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    var p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (var i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0;
      var minv = new Array(n + 1).fill(Infinity);
      var used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        var i0 = p[j0], delta = Infinity, j1 = 0;
        for (var j = 1; j <= n; j++) {
          if (used[j]) continue;
          var cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (var k = 0; k <= n; k++) {
          if (used[k]) { u[p[k]] += delta; v[k] -= delta; }
          else minv[k] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        var jPrev = way[j0];
        p[j0] = p[jPrev];
        j0 = jPrev;
      } while (j0);
    }
    var assign = new Array(n);
    for (var col = 1; col <= n; col++) if (p[col]) assign[p[col] - 1] = col - 1;
    return assign;
  }

  /*
   * Forme les binômes.
   * - students : inscrits ({ id, role: 'parrain' | 'filleul', capacity, … }).
   * - existingPairs : binômes déjà formés ({ parrainId, filleulId }), conservés
   *   sauf si options.reset est vrai.
   * Renvoie { added: [nouveaux binômes], unmatched: [filleuls restés seuls] }.
   */
  function match(students, existingPairs, settings, options) {
    options = options || {};
    var byId = {};
    students.forEach(function (s) { byId[s.id] = s; });
    var parrains = students.filter(function (s) { return s.role === 'parrain'; });
    var filleuls = students.filter(function (s) { return s.role === 'filleul'; });

    var kept = options.reset ? [] : (existingPairs || []).filter(function (p) {
      return byId[p.parrainId] && byId[p.filleulId];
    });
    var load = {}, matched = {};
    kept.forEach(function (p) { load[p.parrainId] = (load[p.parrainId] || 0) + 1; matched[p.filleulId] = true; });

    var free = filleuls.filter(function (f) { return !matched[f.id]; });
    var slots = [];
    parrains.forEach(function (p) {
      for (var k = load[p.id] || 0; k < capacityOf(p); k++) slots.push({ parrain: p, rank: k });
    });
    if (!free.length || !slots.length) return { added: [], unmatched: free };

    var scores = free.map(function (f) {
      var cache = {};
      return slots.map(function (sl) {
        if (!cache[sl.parrain.id]) cache[sl.parrain.id] = score(sl.parrain, f, settings);
        return cache[sl.parrain.id];
      });
    });

    var n = Math.max(free.length, slots.length);
    var cost = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (i >= free.length || j >= slots.length || !scores[i][j].ok) row.push(UNMATCHED);
        else row.push(-scores[i][j].score + SLOT_PENALTY * slots[j].rank);
      }
      cost.push(row);
    }

    var assign = hungarian(cost);
    var added = [], unmatched = [];
    free.forEach(function (f, i) {
      var j = assign[i];
      if (j < slots.length && cost[i][j] < UNMATCHED) {
        added.push({ parrainId: slots[j].parrain.id, filleulId: f.id, score: scores[i][j].score });
      } else {
        unmatched.push(f);
      }
    });
    return { added: added, unmatched: unmatched };
  }

  return {
    CRITERIA: CRITERIA,
    RULES: RULES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    settingsWithDefaults: settingsWithDefaults,
    score: score,
    match: match,
    capacityOf: capacityOf,
    norm: norm,
    asList: asList
  };
});
