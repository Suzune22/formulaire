const test = require('node:test');
const assert = require('node:assert');
const M = require('../matching.js');

function p(id, extra) { return Object.assign({ id, role: 'parrain', capacity: 1 }, extra); }
function f(id, extra) { return Object.assign({ id, role: 'filleul' }, extra); }
const only = (id, rule, weight = 5) => {
  const s = {};
  M.CRITERIA.forEach(c => { s[c.id] = { rule: 'ignore', weight: 0 }; });
  s[id] = { rule, weight };
  return s;
};

test('même école rapporte le poids du critère, sans tenir compte des accents ni de la casse', () => {
  const r = M.score(p('a', { school: 'Université Paris-Cité' }), f('b', { school: 'universite paris cite' }), only('school', 'same', 8));
  assert.strictEqual(r.score, 8);
  assert.deepStrictEqual(r.reasons.map(x => x.label), ['Même école']);
});

test('« de préférence différent » récompense des provenances différentes', () => {
  const s = only('country', 'different', 4);
  assert.strictEqual(M.score(p('a', { country: 'Sénégal' }), f('b', { country: 'France' }), s).score, 4);
  assert.strictEqual(M.score(p('a', { country: 'France' }), f('b', { country: 'France' }), s).score, 0);
});

test('un critère obligatoire non respecté interdit le binôme', () => {
  const s = only('school', 'required');
  assert.strictEqual(M.score(p('a', { school: 'A' }), f('b', { school: 'B' }), s).ok, false);
  assert.strictEqual(M.score(p('a', { school: 'A' }), f('b', {}), s).ok, false);
  assert.strictEqual(M.score(p('a', { school: 'A' }), f('b', { school: 'a' }), s).ok, true);
});

test('les listes comptent les éléments communs, plafonnés à 3', () => {
  const s = only('interests', 'same', 2);
  const r = M.score(p('a', { interests: ['Sport', 'Musique', 'Lecture', 'Cuisine'] }),
    f('b', { interests: 'sport; musique; lecture; cuisine' }), s);
  assert.strictEqual(r.score, 6);
});

test('le bot ne laisse personne de côté pour un seul meilleur couple', () => {
  // Un glouton associerait P1-F1 (meilleur score) et laisserait F2, compatible seulement avec P1.
  const settings = only('interests', 'same', 3);
  settings.mode = { rule: 'required', weight: 0 };
  const students = [
    p('P1', { mode: 'les-deux', interests: ['a', 'b', 'c'] }),
    p('P2', { mode: 'presentiel' }),
    f('F1', { mode: 'presentiel', interests: ['a', 'b', 'c'] }),
    f('F2', { mode: 'distanciel' }),
  ];
  const r = M.match(students, [], settings);
  assert.strictEqual(r.unmatched.length, 0);
  assert.deepStrictEqual(Object.fromEntries(r.added.map(x => [x.filleulId, x.parrainId])), { F1: 'P2', F2: 'P1' });
});

test('le bot respecte les obligations et la capacité des parrains', () => {
  const settings = only('school', 'required');
  const students = [
    p('P1', { school: 'A', capacity: 2 }),
    p('P2', { school: 'B' }),
    f('F1', { school: 'A' }), f('F2', { school: 'A' }), f('F3', { school: 'A' }), f('F4', { school: 'B' }),
  ];
  const r = M.match(students, [], settings);
  const pairs = Object.fromEntries(r.added.map(x => [x.filleulId, x.parrainId]));
  assert.strictEqual(pairs.F4, 'P2');
  assert.strictEqual(r.added.filter(x => x.parrainId === 'P1').length, 2);
  assert.deepStrictEqual(r.unmatched.map(x => x.id).length, 1);
});

test('les binômes existants sont conservés, sauf en recalcul complet', () => {
  const students = [p('P1', { school: 'A' }), p('P2', { school: 'B' }), f('F1', { school: 'B' })];
  const existing = [{ parrainId: 'P1', filleulId: 'F1' }];
  assert.strictEqual(M.match(students, existing, only('school', 'same')).added.length, 0);
  const r = M.match(students, existing, only('school', 'same'), { reset: true });
  assert.deepStrictEqual(r.added.map(x => x.parrainId), ['P2']);
});

test('les filleul·es sont répartis entre les parrains avant de remplir un même parrain', () => {
  const students = [p('P1', { capacity: 3 }), p('P2', { capacity: 3 }), f('F1'), f('F2')];
  const r = M.match(students, [], only('school', 'same'));
  assert.deepStrictEqual(r.added.map(x => x.parrainId).sort(), ['P1', 'P2']);
});

test('grand volume : 300 filleul·es et 150 parrains en moins de 5 s', () => {
  const schools = ['A', 'B', 'C', 'D'], countries = ['FR', 'SN', 'MA', 'CI', 'CM'];
  const students = [];
  for (let i = 0; i < 150; i++) students.push(p('P' + i, { capacity: 2, school: schools[i % 4], country: countries[i % 5] }));
  for (let i = 0; i < 300; i++) students.push(f('F' + i, { school: schools[i % 4], country: countries[(i * 7) % 5] }));
  const t = Date.now();
  const r = M.match(students, [], M.DEFAULT_SETTINGS);
  assert.ok(Date.now() - t < 5000);
  assert.strictEqual(r.added.length, 300);
});
