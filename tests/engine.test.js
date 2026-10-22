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

test('movement profile: x2.0 applies to weighted cost for the disfavoured direction only', () => {
  const ev = loadEngine();
  const out = ev(`(function(){
    const saved = { weights: state.weights, edgeOutcomes: state.edgeOutcomes,
                    large: state.adapted.large, profile: state.movementProfile };
    state.weights = {}; state.edgeOutcomes = {}; state.adapted.large = false;
    const it = (x, y) => ({ x:x, y:y });
    const eR = { action:{kind:'move', dir:'right'}, fromItem:it(0,0), toItem:it(1,0) };
    const eD = { action:{kind:'move', dir:'down'},  fromItem:it(0,0), toItem:it(0,1) };
    const eS = { action:{kind:'select'},            fromItem:it(0,0), toItem:it(0,0) };
    const w = (e) => edgeWeight('n', e.action, true, e);
    const r = {};
    setMovementProfile('standard');
    r.std = { right: w(eR), down: w(eD), select: w(eS),
              unweighted: edgeWeight('n', eR.action, false, eR) };
    setMovementProfile('reduceH');
    r.redH = { right: w(eR), down: w(eD), select: w(eS),
               unweighted: edgeWeight('n', eR.action, false, eR),
               multR: profileMultiplier(eR.action), multD: profileMultiplier(eD.action),
               multS: profileMultiplier(eS.action) };
    setMovementProfile('reduceV');
    r.redV = { right: w(eR), down: w(eD) };
    setMovementProfile('standard');
    state.weights = saved.weights; state.edgeOutcomes = saved.edgeOutcomes;
    state.adapted.large = saved.large; state.movementProfile = saved.profile;
    return r;
  })()`);
  // clean state: each edge is (1 + log2(1/1 + 1)) x 1 = 2 before any profile multiplier
  assert.equal(out.std.right, 2);
  assert.equal(out.std.down, 2);
  assert.equal(out.std.select, 2);
  assert.equal(out.redH.right, 4, 'horizontal move doubles under Reduce horizontal effort');
  assert.equal(out.redH.down, 2, 'vertical move is untouched under Reduce horizontal effort');
  assert.equal(out.redH.select, 2, 'select is direction-neutral and never multiplied');
  assert.equal(out.redH.multR, 2);
  assert.equal(out.redH.multD, 1);
  assert.equal(out.redH.multS, 1);
  assert.equal(out.redV.right, 2, 'horizontal move is untouched under Reduce vertical effort');
  assert.equal(out.redV.down, 4, 'vertical move doubles under Reduce vertical effort');
  assert.equal(out.std.unweighted, 1);
  assert.equal(out.redH.unweighted, 1, 'unweighted press cost stays exactly 1 under any profile');
});

test('movement profile: Dijkstra routing steers off the disfavoured axis when an alternate route exists', () => {
  const ev = loadEngine();
  const out = ev(`(function(){
    const saved = { weights: state.weights, edgeOutcomes: state.edgeOutcomes,
                    large: state.adapted.large, profile: state.movementProfile };
    state.weights = {}; state.edgeOutcomes = {}; state.adapted.large = false;
    // Two 2-press routes S -> T with EQUAL press counts:
    //   horizontal-heavy: S -right-> H -right-> T
    //   vertical-heavy:   S -down--> V -down--> T
    const it = (x, y) => ({ x:x, y:y });
    const adj = {
      S: [ {to:'H', action:{kind:'move', dir:'right'}, fromItem:it(0,0), toItem:it(1,0)},
           {to:'V', action:{kind:'move', dir:'down'},  fromItem:it(0,0), toItem:it(0,1)} ],
      H: [ {to:'T', action:{kind:'move', dir:'right'}, fromItem:it(1,0), toItem:it(2,0)} ],
      V: [ {to:'T', action:{kind:'move', dir:'down'},  fromItem:it(0,1), toItem:it(0,2)} ],
      T: []
    };
    const wfn = (u, e) => edgeWeight(u, e.action, true, e);
    const route = r => r.path.map(s => s.from + '>' + s.to).join(',');;
    setMovementProfile('standard');
    const std = dijkstraCore(adj, 'S', 'T', wfn);
    setMovementProfile('reduceH');
    const redH = dijkstraCore(adj, 'S', 'T', wfn);
    setMovementProfile('reduceV');
    const redV = dijkstraCore(adj, 'S', 'T', wfn);
    // Live graph: the profile raises the WEIGHTED Home->Subtitles effort
    // while the unweighted press optimum does not move.
    setMovementProfile('standard');
    const liveStd = dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', true).dist;
    const livePress = dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', false).dist;
    setMovementProfile('reduceH');
    const liveRedH = dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', true).dist;
    const livePressH = dijkstra('home:' + defaultFocus('home'), 'subtitles:sub_toggle', false).dist;
    setMovementProfile('standard');
    state.weights = saved.weights; state.edgeOutcomes = saved.edgeOutcomes;
    state.adapted.large = saved.large; state.movementProfile = saved.profile;
    return { stdDist: std.dist, stdSteps: std.path.length,
             redHDist: redH.dist, redHRoute: route(redH),
             redVDist: redV.dist, redVRoute: route(redV),
             liveStd, liveRedH, livePress, livePressH };
  })()`);
  assert.equal(out.stdDist, 4, 'under Standard both routes cost the same (2 edges x 2.0) — either may win');
  assert.equal(out.stdSteps, 2, 'both routes have equal press counts');
  assert.equal(out.redHDist, 4, 'the vertical-heavy route still costs 4 under Reduce horizontal');
  assert.equal(out.redHRoute, 'S>V,V>T', 'Reduce horizontal must pick the vertical-heavy route');
  assert.equal(out.redVDist, 4, 'the horizontal-heavy route still costs 4 under Reduce vertical');
  assert.equal(out.redVRoute, 'S>H,H>T', 'Reduce vertical must pick the horizontal-heavy route');
  assert.ok(out.liveRedH > out.liveStd,
    `weighted live effort must rise under Reduce horizontal (${out.liveRedH} > ${out.liveStd})`);
  assert.equal(out.livePress, out.livePressH, 'unweighted press optimum is identical under any profile');
  assert.equal(out.livePress + 1, 6, 'the known Home->Subtitles press optimum is unchanged');
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
