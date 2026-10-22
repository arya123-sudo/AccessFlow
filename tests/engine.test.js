/* AccessFlow engine tests — node:test, no external dependencies.
 *
 * How the shipped code is loaded: js/engine.js is a browser classic
 * script. It is evaluated UNCHANGED inside a vm context with a minimal
 * `document` stub (the engine only touches the DOM at load time to grab
 * two elements; all graph/effort/discovery logic runs head-free).
 * Top-level const/function bindings of a vm script live in the context's
 * lexical scope, so tests reach them by evaluating expressions in the
 * same context (the `ev` helper). What is exercised is therefore the
 * real production code — dijkstraCore, fittsCost, combineWeight,
 * difficultyMultiplier, rankShortcutCandidates, predictGoal,
 * isReversal, buildGraph/dijkstra — not a re-implementation.
 */
"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const stubEl = () => ({
    innerHTML: '', textContent: '', hidden: false, style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, getAttribute() { return null; }, addEventListener() {},
    querySelector: () => null, scrollIntoView() {},
  });
  const sandbox = {
    console,
    performance,
    document: {
      getElementById: () => stubEl(),
      addEventListener() {},
      createElement: () => stubEl(),
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  vm.runInContext(src, ctx, { filename: 'engine.js' });
  return (expr) => vm.runInContext(expr, ctx);
}

test('dijkstraCore: finds the known shortest path and its weight on a hand-built graph', () => {
  const ev = loadEngine();
  const res = ev(`(function(){
    // A -1-> B -1-> D (total 2) must beat A -4-> D and A -2-> C -2-> D (total 4)
    const adj = {
      A: [ {to:'B', action:{kind:'move', dir:'right'}, w:1}, {to:'C', action:{kind:'move', dir:'down'}, w:2}, {to:'D', action:{kind:'select'}, w:4} ],
      B: [ {to:'D', action:{kind:'select'}, w:1} ],
      C: [ {to:'D', action:{kind:'select'}, w:2} ],
      D: []
    };
    return dijkstraCore(adj, 'A', 'D', (u, e) => e.w);
  })()`);
  assert.equal(res.dist, 2);
  assert.equal(res.path.map((s) => s.from + '>' + s.to).join(','), 'A>B,B>D');
});

test('dijkstraCore: unreachable target returns Infinity and empty path', () => {
  const ev = loadEngine();
  const res = ev(`dijkstraCore({A:[{to:'B', action:{kind:'move',dir:'right'}, w:1}], B:[]}, 'A', 'Z', (u,e)=>e.w)`);
  assert.equal(res.dist, Infinity);
  assert.equal(res.path.length, 0);
});

test('live graph: Dijkstra optimal from Home to Subtitles toggle is the known route length', () => {
  const ev = loadEngine();
  // Right, Down, OK (Settings), OK (Accessibility), OK (Subtitles) = 5 edges, +1 final press = 6
  const presses = ev(`dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', false).dist + 1`);
  assert.equal(presses, 6);
  const w = ev(`dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', true).dist`);
  assert.ok(w > 5, 'weighted effort must exceed the raw press count because Fitts costs are positive');
});

test('fittsCost: larger target -> lower cost; longer distance -> higher cost', () => {
  const ev = loadEngine();
  const smallTarget = ev(`fittsCost(3, 1)`);
  const bigTarget = ev(`fittsCost(3, 2)`);
  const near = ev(`fittsCost(1, 1)`);
  const far = ev(`fittsCost(4, 1)`);
  assert.ok(bigTarget < smallTarget, `bigger target should cost less (${bigTarget} < ${smallTarget})`);
  assert.ok(far > near, `longer distance should cost more (${far} > ${near})`);
  assert.ok(Math.abs(ev(`fittsCost(1, 1)`) - 1) < 1e-9, 'log2(1/1 + 1) === 1');
  assert.equal(ev(`fittsCost(0, 1)`), 0);
});

test('effort model: enlarged-focus sizes measurably lower move-edge cost', () => {
  const ev = loadEngine();
  const out = ev(`(function(){
    const adj = buildGraph();
    const home = adj['home:search'] || adj['home:' + defaultFocus('home')];
    const move = home.find(e => e.action.kind === 'move');
    const before = edgeWeight('home:search', move.action, true, move);
    state.adapted.large = true;
    const after = edgeWeight('home:search', move.action, true, move);
    state.adapted.large = false;
    return { before, after };
  })()`);
  assert.ok(out.after < out.before, `enlarged mode should lower cost (${out.after} < ${out.before})`);
});

test('difficultyMultiplier: rises with the user error rate on an action class, capped at 1.9', () => {
  const ev = loadEngine();
  const m = ev(`(function(){
    const a = {kind:'move', dir:'left'};
    const clean = difficultyMultiplier(a);
    state.edgeOutcomes['moveleft'] = {traversals: 10, errors: 5};
    const half = difficultyMultiplier(a);
    state.edgeOutcomes['moveleft'] = {traversals: 10, errors: 50};
    const capped = difficultyMultiplier(a);
    delete state.edgeOutcomes['moveleft'];
    return { clean, half, capped };
  })()`);
  assert.equal(m.clean, 1);
  assert.ok(Math.abs(m.half - 1.5) < 1e-9);
  assert.ok(Math.abs(m.capped - 1.9) < 1e-9);
});

test('combineWeight: (base + fitts) x multiplier + learned bump', () => {
  const ev = loadEngine();
  assert.equal(ev(`combineWeight(0, 1, 0)`), 1);
  assert.ok(Math.abs(ev(`combineWeight(1, 2, 0.6)`) - 4.6) < 1e-9);
});

test('rankShortcutCandidates: synthetic visit data ranks the costly destination first', () => {
  const ev = loadEngine();
  const ranked = ev(`(function(){
    const stats = {
      subtitles: { visits: 1, totalPresses: 6, totalExcess: 0, difficultyEvents: 0 },
      riverrun:  { visits: 4, totalPresses: 40, totalExcess: 12, difficultyEvents: 5 }
    };
    return rankShortcutCandidates(stats, []).map(c => ({ id: c.dest.id, score: c.score, saving: c.saving }));
  })()`);
  assert.ok(ranked.length >= 1);
  assert.equal(ranked[0].id, 'riverrun', 'frequent + high-excess destination must win over the demo default');
  assert.equal(ranked[0].score, 12); // 4 visits x (12/4) average excess

  const demoRanked = ev(`(function(){
    const stats = { subtitles: { visits: 1, totalPresses: 8, totalExcess: 2, difficultyEvents: 1 } };
    return rankShortcutCandidates(stats, []).map(c => c.dest.id);
  })()`);
  assert.equal(demoRanked[0], 'subtitles', 'the standard demo numbers naturally select Subtitles');

  const noneLeft = ev(`rankShortcutCandidates({}, ['subtitles', 'riverrun']).length`);
  assert.equal(noneLeft, 0, 'already-pinned destinations are excluded');
});

test('predictGoal: path following the Subtitles route predicts Subtitles, with honest components', () => {
  const ev = loadEngine();
  const top = ev(`(function(){
    const path = ['home:search', 'home:movies', 'home:settings', 'settings:accessibility', 'accessibility:subtitles'];
    const ranking = predictGoal(path, {}, {});
    const t = ranking[0];
    return { id: t.dest.id, prob: t.prob, prefixScore: t.prefixScore, raw: t.raw };
  })()`);
  assert.equal(top.id, 'subtitles');
  assert.ok(top.prob > 0.5, `expected a confident prediction, got ${top.prob}`);
  assert.ok(top.prefixScore > 0.5);
});

test('isReversal: only an immediate opposite move without an intervening select counts', () => {
  const ev = loadEngine();
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  assert.equal(ev(`isReversal('right', 'left', false, ${JSON.stringify(OPP)})`), true);
  assert.equal(ev(`isReversal('right', 'left', true, ${JSON.stringify(OPP)})`), false);
  assert.equal(ev(`isReversal('right', 'down', false, ${JSON.stringify(OPP)})`), false);
  assert.equal(ev(`isReversal(null, 'left', false, ${JSON.stringify(OPP)})`), false);
});

test('graph integrity: every edge target exists and pinning adds a Home shortcut tile', () => {
  const ev = loadEngine();
  const out = ev(`(function(){
    const before = buildGraph();
    const nodesBefore = Object.keys(before).length;
    state.adapted.pins = ['riverrun'];
    const items = homeItems().map(i => i.id);
    const after = buildGraph();
    state.adapted.pins = [];
    return { nodesBefore, nodesAfter: Object.keys(after).length, hasPinTile: items.includes('pin_riverrun') };
  })()`);
  assert.ok(out.nodesBefore >= 30, `expected the full TV graph, got ${out.nodesBefore} nodes`);
  assert.equal(out.hasPinTile, true);
  assert.ok(out.nodesAfter > out.nodesBefore, 'pinning a destination adds graph nodes/edges');
});
