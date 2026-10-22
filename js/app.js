/* AccessFlow app — interaction logging, difficulty detection, metrics,
   task flow (baseline run -> approved adaptation -> adapted run), and UI wiring. */
"use strict";
/* ---------------- logging & metrics ---------------- */
function fmt(ms){
  const s = Math.max(0, Math.round(ms/1000));
  return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}
function stamp(){
  if(run && run.started) return fmt((run.active ? performance.now() : run.endT) - run.startT);
  return fmt(performance.now() - pageStart);
}
function logEvent(msg, cls){
  const ul = $('eventLog');
  const li = document.createElement('li');
  if(cls) li.className = cls;
  li.innerHTML = '<span class="t">' + stamp() + '</span><span></span>';
  li.lastChild.textContent = msg;
  ul.insertBefore(li, ul.firstChild);
  while(ul.children.length > 40) ul.removeChild(ul.lastChild);
}
function addEvent(type, msg){
  if(!run || !run.active) return;
  run.events++;
  if(type==='reversal') run.reversals++;
  if(type==='backtrack') run.backtracks++;
  if(type==='wrongselect') run.errors++;
  if(type==='hesitation') run.hesitations++;
  logEvent(msg, 'bad');
  maybeSuggest();
  maybeRecover(type);
}

const ARROWS = { up:'▲ Up', down:'▼ Down', left:'◀ Left', right:'▶ Right' };
const OPP = { up:'down', down:'up', left:'right', right:'left' };

function itemLabel(screenId, itemId){
  const d = getScreens()[screenId];
  const it = d && d.items.find(i=>i.id===itemId);
  return it ? it.label : itemId;
}
function screenTitle(sid){ return getScreens()[sid].title; }

function renderPath(){
  const box = $('pathBox'), effort = $('effortLine');
  const tgt = currentTarget();
  if(!tgt){ box.innerHTML = '<span class="empty-note">No active task — the engine idles.</span>'; effort.textContent=''; $('mOpt').textContent='–'; return; }
  const cur = nodeKey();
  const res = dijkstra(cur, tgt.node, false);
  const wres = dijkstra(cur, tgt.node, true);
  if(cur === tgt.node){
    box.innerHTML = '<div class="pathchips"><span class="chip final">' + tgt.finalChip + '</span></div>';
    effort.innerHTML = 'You are on the target. One press finishes it.';
    $('mOpt').textContent = '1';
    return;
  }
  const chips = res.path.map(st=>{
    if(st.action.kind==='move') return '<span class="chip">' + ARROWS[st.action.dir].split(' ')[0] + ' ' + itemLabel(st.to.split(':')[0], st.to.split(':')[1]) + '</span>';
    if(st.action.kind==='select') return '<span class="chip">OK → ' + screenTitle(st.to.split(':')[0]) + '</span>';
    if(st.action.kind==='back') return '<span class="chip">Back → ' + screenTitle(st.to.split(':')[0]) + '</span>';
    return '<span class="chip">Home</span>';
  });
  chips.push('<span class="chip final">' + tgt.finalChip + '</span>');
  box.innerHTML = '<div class="pathchips">' + chips.join('') + '</div>';
  const rw = Object.keys(state.weights).length;
  effort.innerHTML = 'Optimal: <b>' + (res.path.length + 1) + ' presses</b> · Weighted effort: <b>' + wres.dist.toFixed(1) + '</b>' +
    (rw ? ' · <b>' + rw + '</b> edge' + (rw>1?'s':'') + ' re-weighted by your difficulty signals' : ' · no edges re-weighted yet');
  $('mOpt').textContent = String(res.path.length + 1);
}

function renderMetrics(){
  if(!run) return;
  $('mPresses').textContent = run.presses;
  $('mErrors').textContent = run.errors;
  $('mBack').textContent = run.backtracks;
  $('mRev').textContent = run.reversals;
  $('mTime').textContent = run.started ? fmt((run.active ? performance.now() : run.endT) - run.startT) : '0:00';
  const adj = buildGraph();
  const nodes = Object.keys(adj).length;
  const edges = Object.values(adj).reduce((a,v)=>a+v.length,0);
  const errPct = Math.round(userErrorRate() * 100);
  $('engineLine').innerHTML = 'Graph engine: <b>' + nodes + ' nodes · ' + edges + ' edges</b> · Dijkstra live · ' +
    Object.keys(state.weights).length + ' learned weight' + (Object.keys(state.weights).length===1?'':'s') +
    '<br>Effort model: weight = (1 + Fitts log\u2082(d/size + 1)) \u00D7 (1 + your error rate) + learned bumps \u00B7 your error rate so far: <b>' +
    errPct + '%</b> \u00B7 target sizes \u00D7' + (state.adapted.large ? '1.5 (enlarged mode)' : '1.0') +
    ' \u00B7 optimal-press figures always use a pure count of 1 per press';
}

function updateAll(){ renderTV(); renderMetrics(); renderPath(); refreshRecoverText(); renderAdaptations(); }

/* ---------------- press handling ---------------- */
function beginPress(guided){
  const now = performance.now();
  if(!run || !run.active) return;
  if(!run.started){
    run.started = true; run.startT = now; run.lastPressT = now;
    logEvent('Run started — timer running.');
    if(!guided) run.presses++;
    return;
  }
  if(guided) return;
  const gap = now - run.lastPressT;
  run.presses++;
  run.lastPressT = now;
  if(gap > 4000)
    addEvent('hesitation', 'Hesitation — ' + Math.round(gap/1000) + 's pause before this press. The interface gave no hint where to go next.');
}

function doMove(dir, guided){
  const def = currentDef();
  const item = currentItem();
  const nb = neighborFor(def.items, item, dir);
  if(!nb){ if(!guided) logEvent(ARROWS[dir] + ' — no tile that way.'); return; }
  if(!guided && run && run.active) noteTraversal({kind:'move', dir:dir});
  if(!guided && run && run.active){
    if(isReversal(run.lastDir, dir, run.selectSince, OPP)){
      bumpWeight(nodeKey(), {kind:'move', dir:dir});
      bumpWeight(nodeKey(state.screen, nb.id), {kind:'move', dir:OPP[dir]});
      state.focusId = nb.id;
      addEvent('reversal', 'Overshoot / reversal — you moved ' + ARROWS[run.lastDir] + ' then straight back ' + ARROWS[dir] + ', passing “' + item.label + '”. That edge just got heavier in the graph.');
      run.lastDir = dir; run.selectSince = false; run.visited.add(nodeKey());
      return;
    }
    run.lastDir = dir; run.selectSince = false;
  }
  state.focusId = nb.id;
  if(run && run.active) run.visited.add(nodeKey());
}

function doBack(guided){
  if(state.screen==='home'){ if(!guided) toast('You are already on Home.'); return; }
  let dest;
  if(state.navStack.length) dest = state.navStack.pop();
  else { const p = PARENT[state.screen]; dest = { screen:p, focusId: ENTRY_ITEM[state.screen] || defaultFocus(p) }; }
  if(state.screen==='player') state.playing = false;
  state.screen = dest.screen; state.focusId = dest.focusId;
  if(!guided && run && run.active) noteTraversal({kind:'back'});
  if(run && run.active){ run.selectSince = true; run.lastDir = null; }
  if(!guided && run && run.active)
    addEvent('backtrack', 'Backtrack — pressed Back to ' + screenTitle(dest.screen) + '.');
}

function doHome(guided){
  state.navStack = [];
  state.screen = 'home';
  state.focusId = defaultFocus('home');
  if(state.playing) state.playing = false;
  if(!guided && run && run.active) noteTraversal({kind:'home'});
  if(run && run.active){ run.selectSince = true; run.lastDir = null; }
  if(!guided) logEvent('Pressed Home.');
}

function resultingNode(item){
  const a = item.action;
  if(a.type==='nav') return a.to + ':' + defaultFocus(a.to);
  if(a.type==='openDetail') return 'detail:play';
  if(a.type==='play') return 'player:playpause';
  return nodeKey();
}

function doSelect(guided){
  const item = currentItem();
  if(!item) return;
  const a = item.action;
  const tgt = currentTarget();
  const completes = !!tgt && state.screen===tgt.screen && state.focusId===tgt.itemId &&
    ((a.type==='toggle' && a.key==='subtitles' && !state.settings.subtitles) || a.type==='play');

  if(!guided && run && run.active){ run.selectSince = true; run.lastDir = null; noteTraversal({kind:'select'}); }

  // wrong-select detection: a select that doesn't reduce Dijkstra distance to target
  if(!guided && run && run.active && tgt && !completes){
    const d0 = dijkstra(nodeKey(), tgt.node, false).dist;
    const d1 = dijkstra(resultingNode(item), tgt.node, false).dist;
    if(d1 >= d0){
      bumpWeight(nodeKey(), {kind:'select'});
      executeAction(item, a);
      addEvent('wrongselect', 'Wrong selection — “' + item.label + '” does not lead toward ' + tgt.name + '. The optimal route is unchanged at ' + (d0+1) + ' presses.');
      return;
    }
  }
  executeAction(item, a);
  if(completes) completeTask();
}

function executeAction(item, a){
  if(run && run.active) run.visited.add(nodeKey());
  switch(a.type){
    case 'nav':
      state.navStack.push({screen:state.screen, focusId:state.focusId});
      state.screen = a.to; state.focusId = defaultFocus(a.to);
      break;
    case 'openDetail':
      state.navStack.push({screen:state.screen, focusId:state.focusId});
      state.detail = { id:a.movie.id, title:a.movie.title, meta:a.movie.meta, hue:a.movie.hue, kind:a.kind };
      state.screen = 'detail'; state.focusId = 'play';
      break;
    case 'play':
      state.navStack.push({screen:state.screen, focusId:state.focusId});
      state.screen = 'player'; state.focusId = 'playpause'; state.playing = true;
      break;
    case 'playpause':
      state.playing = !state.playing;
      toast(state.playing ? 'Playing' : 'Paused');
      break;
    case 'toggle': {
      state.settings[a.key] = !state.settings[a.key];
      toast(a.name + ': ' + (state.settings[a.key] ? 'On' : 'Off'));
      if(a.key==='highContrast') logEvent('High Contrast ' + (state.settings.highContrast?'on':'off') + ' — the TV theme responded instantly.', 'guide');
      break;
    }
    case 'cycle': {
      const vals = a.values;
      const i = vals.indexOf(state.settings[a.key]);
      state.settings[a.key] = vals[(i+1) % vals.length];
      toast(a.name + ': ' + state.settings[a.key]);
      break;
    }
    case 'noop':
      toast(a.msg);
      break;
  }
  if(run && run.active) run.visited.add(nodeKey());
}

function press(kind, guided){
  beginPress(!!guided);
  if(kind==='up'||kind==='down'||kind==='left'||kind==='right') doMove(kind, !!guided);
  else if(kind==='ok') doSelect(!!guided);
  else if(kind==='back') doBack(!!guided);
  else if(kind==='home') doHome(!!guided);
  if(run && run.active) run.pathSeq.push(nodeKey());
  updateAll();
}

/* ---------------- run statistics & shortcut discovery ----------------
   After every completed run we fold its measured numbers into
   state.destStats. Suggestions are then GENERATED by
   rankShortcutCandidates() from that data — the winning destination
   is whichever destination the user's own runs made most expensive,
   not a destination anyone pre-selected in code.                    */
function findingsList(){
  const parts = [];
  if(!run) return parts;
  if(run.reversals) parts.push(run.reversals + ' overshoot' + (run.reversals>1?'s':'') + ' / direction reversal' + (run.reversals>1?'s':''));
  if(run.backtracks) parts.push(run.backtracks + ' backtrack' + (run.backtracks>1?'s':''));
  if(run.errors) parts.push(run.errors + ' wrong selection' + (run.errors>1?'s':''));
  if(run.hesitations) parts.push(run.hesitations + ' long hesitation' + (run.hesitations>1?'s':''));
  return parts;
}
function optimalFromHome(){
  return optimalFromHomeFor('subtitles:sub_toggle');
}
function recordRunStats(rec){
  if(!rec || !rec.destId) return;
  const s = state.destStats[rec.destId] ||
    (state.destStats[rec.destId] = {visits:0, totalPresses:0, totalExcess:0, difficultyEvents:0});
  s.visits++;
  s.totalPresses += rec.presses;
  s.totalExcess += Math.max(0, rec.presses - (rec.optStart || rec.presses));
  s.difficultyEvents += rec.reversals + rec.backtracks + rec.errors + rec.hesitations;
  learnPrefixes(rec.pathSeq, rec.destId);
}
/* Stats used for ranking: completed runs plus, for a mid-run
   suggestion, the in-progress run's numbers for its destination. */
function statsForRanking(){
  const merged = {};
  for(const id of Object.keys(state.destStats)) merged[id] = Object.assign({}, state.destStats[id]);
  if(run && run.active && run.destId){
    const m = merged[run.destId] || (merged[run.destId] = {visits:0, totalPresses:0, totalExcess:0, difficultyEvents:0});
    m.visits++;
    m.totalPresses += run.presses;
    m.totalExcess += Math.max(0, run.presses - (run.optStart || run.presses));
    m.difficultyEvents += run.reversals + run.backtracks + run.errors + run.hesitations;
  }
  return merged;
}
function computeSuggestion(){
  const cands = rankShortcutCandidates(statsForRanking(), state.adapted.pins);
  if(!cands.length) return null;
  const top = cands[0];
  const evidence = [];
  if(top.visits) evidence.push(top.visits + ' measured run' + (top.visits>1?'s':'') + ' to ' + top.dest.name +
    ' \u00B7 ' + top.totalPresses + ' total presses' +
    (top.totalExcess > 0 ? ' \u00B7 ' + top.totalExcess + ' excess presses vs the Dijkstra optimal' : ' \u00B7 no excess presses'));
  if(top.difficultyEvents) evidence.push(top.difficultyEvents + ' difficulty events recorded on the way there');
  evidence.push('Discovery score (visits \u00D7 average excess cost): ' + top.score.toFixed(1) +
    ' \u2014 highest of ' + cands.length + ' candidate destination' + (cands.length>1?'s':''));
  evidence.push('Pinning it drops the optimal route from ' + top.optNow + ' presses to ' + top.optPinned + '.');
  return { dest:top.dest, visits:top.visits, totalPresses:top.totalPresses, totalExcess:top.totalExcess,
           difficultyEvents:top.difficultyEvents, score:top.score, optNow:top.optNow, optPinned:top.optPinned,
           evidence:evidence,
           focusTrouble: run ? (run.reversals + run.backtracks) : 0 };
}

/* ---------------- adaptation audit trail + undo ---------------- */
let adaptSeq = 0;
function recordAdaptation(entry){
  entry.id = ++adaptSeq;
  entry.time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  state.adaptations.push(entry);
  renderAdaptations();
}
function renderAdaptations(){
  const body = $('adaptList');
  if(!body) return;
  if(!state.adaptations.length){
    body.innerHTML = '<p class="empty-note">No adaptations yet. Every suggestion, approval, dismissal and undo is recorded here \u2014 your audit trail.</p>';
    return;
  }
  body.innerHTML = state.adaptations.slice().reverse().map(a=>{
    const tag = a.status==='applied' ? '<span class="atag applied">Applied</span>'
              : a.status==='undone' ? '<span class="atag undone">Undone</span>'
              : '<span class="atag dismissed">Dismissed</span>';
    const undo = a.status==='applied'
      ? '<button class="btn ghost small" type="button" data-undo="' + a.id + '">Undo</button>' : '';
    return '<div class="adapt-entry"><div class="txt"><b>' + a.label + '</b> ' + tag +
           '<span>' + a.evidence + '</span><span class="atime">' + a.time + '</span></div>' + undo + '</div>';
  }).join('');
}
function undoAdaptation(id){
  const a = state.adaptations.find(x=>x.id===id);
  if(!a || a.status!=='applied') return;
  if(a.kind==='pin'){
    state.adapted.pins = state.adapted.pins.filter(d=>d!==a.destId);
    if(state.focusId===pinTileId(a.destId)) state.focusId = defaultFocus(state.screen);
    logEvent('Undo: the ' + a.label + ' was reverted \u2014 shortcut tile and its graph edge removed.', 'guide');
  } else if(a.kind==='large'){
    state.adapted.large = false;
    logEvent('Undo: enlarged focus reverted \u2014 target sizes and effort costs are back to standard.', 'guide');
  }
  a.status = 'undone';
  updateAll();
}

/* ---------------- suggestion card (generated from the data) ---------------- */
function showSuggestion(reason){
  if(state.suggestionShown && reason==='threshold') return;
  const sug = computeSuggestion();
  if(!sug) return;
  state.suggestionShown = true;
  state.pendingSuggestion = sug;
  const card = $('suggestCard');
  $('pinTitle').textContent = 'Pin a ' + sug.dest.name + ' shortcut on Home';
  $('pinEffect').textContent = 'Discovered from your runs: ' + sug.visits + ' visit' + (sug.visits===1?'':'s') +
    ', ' + sug.totalPresses + ' presses' + (sug.totalExcess ? ', ' + sug.totalExcess + ' of them excess' : '') +
    '. Adds a direct Home \u2192 ' + sug.dest.name + ' route \u2014 optimal drops from ' + sug.optNow + ' presses to ' + sug.optPinned + '.';
  const showLarge = sug.focusTrouble >= 1;
  $('largeRow').style.display = showLarge ? '' : 'none';
  if(showLarge)
    $('largeEffect').textContent = 'Your ' + run.reversals + ' overshoot/reversal' + (run.reversals===1?'':'s') +
      ' suggest aiming is the hard part. Bigger targets also lower the Fitts cost of every move.';
  if(reason==='complete' && !findingsList().length){
    $('suggestText').textContent = 'That was a clean run \u2014 no difficulties detected. AccessFlow\u2019s discovery pass over your run data still found a route worth shortening:';
  } else if(reason==='complete'){
    $('suggestText').textContent = 'Run measured. AccessFlow analysed your destination statistics and discovered this:';
  } else {
    $('suggestText').textContent = 'AccessFlow has detected enough friction to analyse your runs \u2014 here is what the data says:';
  }
  $('suggestFindings').innerHTML = '<ul>' + sug.evidence.map(p=>'<li>' + p + '</li>').join('') + '</ul>';
  card.classList.add('show');
  logEvent('AccessFlow discovered a candidate from your data: ' + sug.dest.name + ' (score ' + sug.score.toFixed(1) + '). Waiting for your decision \u2014 nothing changes without approval.', 'guide');
  card.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function maybeSuggest(){
  if(state.phase!=='task1' || !run || !run.active) return;
  if(run.events >= 3 && !state.suggestionShown) showSuggestion('threshold');
}
function hideSuggestion(){ $('suggestCard').classList.remove('show'); }

function applyAdaptations(fromComplete){
  const sug = state.pendingSuggestion;
  const pinWanted = $('pinSwitch').getAttribute('aria-pressed')==='true';
  const largeRowShown = $('largeRow').style.display !== 'none';
  const largeWanted = largeRowShown && $('largeSwitch').getAttribute('aria-pressed')==='true';
  const evidenceText = sug ? sug.evidence.join(' \u00B7 ') : findingsList().join(', ');
  let appliedAny = false;
  if(pinWanted && sug){
    if(!state.adapted.pins.includes(sug.dest.id)) state.adapted.pins.push(sug.dest.id);
    recordAdaptation({ kind:'pin', destId:sug.dest.id, status:'applied',
      label:'Pinned ' + sug.dest.name + ' shortcut on Home', evidence:evidenceText });
    logEvent('Approved: ' + sug.dest.name + ' shortcut pinned on Home (discovered from your run data). The graph gained a shorter edge.', 'good');
    appliedAny = true;
  }
  if(largeWanted){
    state.adapted.large = true;
    recordAdaptation({ kind:'large', status:'applied',
      label:'Enlarged focus & targets', evidence:evidenceText });
    logEvent('Approved: enlarged focus and targets are on \u2014 Fitts costs recomputed with larger target sizes.', 'good');
    appliedAny = true;
  }
  if(!appliedAny){
    state.decision = 'dismissed';
    recordAdaptation({ kind:'suggestion', status:'dismissed',
      label:'Suggestion dismissed' + (sug ? ' (' + sug.dest.name + ' shortcut)' : ''), evidence:evidenceText });
    logEvent('No adaptations applied \u2014 layout stays standard.', 'guide');
  } else {
    state.decision = 'approved';
  }
  hideSuggestion();
  if(state.screen==='home' && sug && pinWanted) state.focusId = pinTileId(sug.dest.id);
  if(fromComplete || state.phase==='adapt') startTask2();
  updateAll();
}

/* ---------------- recovery ---------------- */
function maybeRecover(type){
  if(!run || !run.active) return;
  if(state.phase!=='task1' && state.phase!=='task2' && state.phase!=='task3') return;
  if(performance.now() < state.recoverCooldownUntil) return;
  if($('recoverCard').classList.contains('show')) return;
  if(run.backtracks >= 3 || run.reversals >= 3){
    showRecover(run.backtracks >= 3 ? 'You have backed up ' + run.backtracks + ' times on this task.'
                                     : 'You have reversed direction ' + run.reversals + ' times on this task.');
  }
}
/* Goal for recovery: PREFIX-BASED PREDICTION (see predictGoal in
   engine.js) — the user's path so far is matched against each
   destination's canonical route, blended with learned prefix counts
   and visit history. Pure counting over the graph; no LLM involved.
   Falls back to the active task target when there is no signal. */
function predictedGoalNode(){
  if(run && run.pathSeq && run.pathSeq.length){
    const ranking = predictGoal(run.pathSeq, state.destStats, state.prefixCounts);
    const top = ranking[0];
    if(top && top.raw > 0){
      state.currentPrediction = top;
      return { node:top.dest.node, name:top.dest.name, pred:top };
    }
  }
  state.currentPrediction = null;
  const tgt = currentTarget();
  return tgt ? { node:tgt.node, name:tgt.name, pred:null } : null;
}
function nextStepInfo(goal){
  const g = goal || predictedGoalNode();
  if(!g) return null;
  const cur = nodeKey();
  if(cur === g.node) return { final:true, goal:g, text:'You are on the target — one OK press finishes it.' };
  const res = dijkstra(cur, g.node, false);
  if(!res.path.length) return null;
  const st = res.path[0];
  if(st.action.kind==='move') return { step:st, goal:g, text:'Next step: move ' + ARROWS[st.action.dir] + ' to “' + itemLabel(st.to.split(':')[0], st.to.split(':')[1]) + '”.' };
  if(st.action.kind==='select') return { step:st, goal:g, text:'Next step: press OK to open ' + screenTitle(st.to.split(':')[0]) + '.' };
  if(st.action.kind==='back') return { step:st, goal:g, text:'Next step: press Back to return to ' + screenTitle(st.to.split(':')[0]) + '.' };
  return { step:st, goal:g, text:'Next step: press Home.' };
}
function refreshRecoverText(){
  if(!$('recoverCard').classList.contains('show')) return;
  const g = predictedGoalNode();
  const info = nextStepInfo(g);
  if(!g){ $('recoverTitle').textContent = 'Need a hand?'; return; }
  if(g.pred){
    $('recoverTitle').textContent = 'Predicted goal: ' + g.name + ' (' + Math.round(g.pred.prob * 100) + '% likely)';
    if(info) $('recoverText').textContent = ($('recoverText').dataset.reason || '') + ' ' + info.text +
      ' Prediction basis: ' + Math.round(g.pred.prefixScore * 100) + '% of ' + g.name + '\u2019s usual route matches your path so far' +
      (g.pred.histScore > 0 ? ', plus your past visits to it' : '') +
      (g.pred.learnScore > 0 ? ', plus routes you completed before' : '') +
      '. Predicted from your path so far + past visits \u2014 simple counting over the navigation graph, not an LLM.';
  } else {
    $('recoverTitle').textContent = 'Looks like you\'re heading for ' + g.name.replace("Play 'River Run'", 'River Run');
    if(info) $('recoverText').textContent = ($('recoverText').dataset.reason || '') + ' ' + info.text + ' AccessFlow computed this from the live graph.';
  }
}
function showRecover(reason){
  const card = $('recoverCard');
  $('recoverText').dataset.reason = reason;
  card.classList.add('show');
  refreshRecoverText();
  logEvent('Recovery offered — AccessFlow computed a guided next step.', 'guide');
}
function hideRecover(){ $('recoverCard').classList.remove('show'); }

/* ---------------- task flow ---------------- */
function setTaskCard(kicker, title, desc, routeHTML, done){
  $('taskKicker').textContent = kicker;
  $('taskTitle').textContent = title;
  $('taskDesc').textContent = desc;
  $('taskRoute').innerHTML = routeHTML || '';
  $('taskCard').classList.toggle('done', !!done);
}
function routeLine(){
  const n = optimalFromHome();
  return 'Fastest route from Home right now: <b>' + n + ' presses</b> — Home → Settings → Accessibility → Subtitles → On';
}
function startTask2(){
  state.settings.subtitles = false;
  state.navStack = [];
  state.screen = 'home'; state.focusId = defaultFocus('home');
  state.phase = 'task2';
  run = freshRun('task2');
  run.optStart = optimalFromHomeFor('subtitles:sub_toggle');
  hideRecover();
  const adapted = state.decision==='approved';
  setTaskCard(
    adapted ? 'Task 2 of 2 · Adapted run' : 'Task 2 of 2 · Standard layout (adaptation not applied)',
    'Turn on Subtitles — again',
    adapted
      ? 'Same task, adapted interface. Subtitles were reset to Off. Use your new Home shortcut and feel the difference — this run is measured against Run 1.'
      : 'Same task on the standard layout. Subtitles were reset to Off. This run is measured against Run 1.',
    routeLine());
  logEvent('Task 2 started — subtitles reset to Off. ' + (adapted ? 'Adaptations are live.' : 'No adaptations applied.'), 'guide');
  updateAll();
}
function startTask3(){
  state.navStack = [];
  state.screen = 'home'; state.focusId = defaultFocus('home');
  state.phase = 'task3';
  run = freshRun('task3');
  run.optStart = optimalFromHomeFor('detail:play');
  hideRecover();
  const n = dijkstra('home:' + defaultFocus('home'), 'detail:play', false).dist + 1;
  setTaskCard('Bonus task', 'Play the movie “River Run”',
    'Home → Movies → River Run → Play. AccessFlow keeps detecting and guiding, exactly as before.',
    'Fastest route from Home: <b>' + n + ' presses</b> — Home → Movies → River Run → Play');
  logEvent('Task 3 started — play River Run.', 'guide');
  updateAll();
}
function completeTask(){
  run.active = false;
  run.endT = performance.now();
  const rec = { presses:run.presses, errors:run.errors, backtracks:run.backtracks,
                reversals:run.reversals, hesitations:run.hesitations, time:(run.endT - run.startT)/1000,
                destId:run.destId, optStart:run.optStart, pathSeq:run.pathSeq.slice() };
  recordRunStats(rec);
  hideRecover();
  if(state.phase==='task1'){
    results.run1 = rec;
    state.phase = 'adapt';
    logEvent('Task 1 complete — ' + rec.presses + ' presses, ' + rec.errors + ' errors, ' + rec.time.toFixed(1) + 's.', 'good');
    setTaskCard('Task 1 complete · Run 1 measured', 'Subtitles are on',
      'Your baseline is recorded below. Now decide whether AccessFlow may adapt the interface before the re-run.',
      routeLine(), true);
    renderResults();
    if(!state.suggestionShown) showSuggestion('complete');
    else if(state.decision==='approved') startTask2();
    else if(state.decision==='dismissed') startTask2();
  }
  else if(state.phase==='task2'){
    results.run2 = rec;
    state.phase = 'results';
    logEvent('Task 2 complete — ' + rec.presses + ' presses, ' + rec.errors + ' errors, ' + rec.time.toFixed(1) + 's. Compare both runs below.', 'good');
    setTaskCard('Both runs complete', 'See the difference you made',
      'The before/after table below is built entirely from your two measured runs.',
      '<button class="btn primary small" id="startTask3Btn" type="button">Start bonus Task 3 · Play “River Run”</button>', true);
    renderResults();
    $('startTask3Btn').addEventListener('click', startTask3);
    $('resultsPanel').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  else if(state.phase==='task3'){
    state.phase = 'done';
    logEvent('Task 3 complete — River Run is playing. All demo tasks done.', 'good');
    setTaskCard('All tasks complete', 'That is the full AccessFlow loop',
      'Detection, graph optimization, your approval, adaptation — all measured. Explore the TV freely, or restart the demo from the top.',
      '', true);
    toast('Now playing: River Run');
  }
  updateAll();
}

/* ---------------- results ---------------- */
function impCell(a, b){
  if(a===null || b===null || a===0) return '<td>—</td>';
  const pct = Math.round((a - b) / a * 100);
  if(pct > 0) return '<td class="imp">' + pct + '% less</td>';
  if(pct < 0) return '<td style="color:var(--red);font-weight:700;">' + Math.abs(pct) + '% more</td>';
  return '<td>same</td>';
}
function renderResults(){
  const body = $('resultsBody');
  const r1 = results.run1, r2 = results.run2;
  if(!r1){
    body.innerHTML = '<p class="empty-note">Run 1 (baseline) and Run 2 (adapted) will appear here once you complete them. Every number comes from your own presses in this session — nothing is pre-filled.</p>';
    return;
  }
  const row = (label, v1, v2, fmtFn)=>{
    const f = fmtFn || (v=>v);
    return '<tr><td>' + label + '</td><td>' + (v1!==null?f(v1):'—') + '</td><td>' + (v2!==null?f(v2):'—') + '</td>' +
           (r2 ? impCell(v1, v2) : '<td>—</td>') + '</tr>';
  };
  let html = '<table class="results-table"><thead><tr><th>Metric</th><th>Run 1 · Baseline</th><th>Run 2 · ' +
             (state.decision==='approved' ? 'Adapted' : 'Standard') + '</th><th>Change</th></tr></thead><tbody>' +
             row('Presses', r1.presses, r2 ? r2.presses : null) +
             row('Errors', r1.errors, r2 ? r2.errors : null) +
             row('Backtracks', r1.backtracks, r2 ? r2.backtracks : null) +
             row('Reversals', r1.reversals, r2 ? r2.reversals : null) +
             row('Time', r1.time, r2 ? r2.time : null, v=>v.toFixed(1) + 's') +
             '</tbody></table>';
  if(r2){
    const maxP = Math.max(r1.presses, r2.presses, 1);
    const maxT = Math.max(r1.time, r2.time, 0.1);
    html += '<div class="bars">' +
      '<div class="bar-row"><span>Presses · Run 1</span><div class="bar-track"><div class="bar-fill" style="width:' + Math.round(r1.presses/maxP*100) + '%"></div></div><span class="v">' + r1.presses + '</span></div>' +
      '<div class="bar-row"><span>Presses · Run 2</span><div class="bar-track"><div class="bar-fill run2" style="width:' + Math.round(r2.presses/maxP*100) + '%"></div></div><span class="v">' + r2.presses + '</span></div>' +
      '<div class="bar-row"><span>Time · Run 1</span><div class="bar-track"><div class="bar-fill" style="width:' + Math.round(r1.time/maxT*100) + '%"></div></div><span class="v">' + r1.time.toFixed(1) + 's</span></div>' +
      '<div class="bar-row"><span>Time · Run 2</span><div class="bar-track"><div class="bar-fill run2" style="width:' + Math.round(r2.time/maxT*100) + '%"></div></div><span class="v">' + r2.time.toFixed(1) + 's</span></div>' +
      '</div>';
  } else {
    html += '<p class="empty-note" style="margin-top:10px;">Run 2 has not happened yet — approve (or decline) the adaptation and repeat the task to fill this in.</p>';
  }
  body.innerHTML = html;
}

/* ---------------- wiring ---------------- */
$('btnUp').addEventListener('click', ()=>press('up'));
$('btnDown').addEventListener('click', ()=>press('down'));
$('btnLeft').addEventListener('click', ()=>press('left'));
$('btnRight').addEventListener('click', ()=>press('right'));
$('btnOk').addEventListener('click', ()=>press('ok'));
$('btnBack').addEventListener('click', ()=>press('back'));
$('btnHome').addEventListener('click', ()=>press('home'));

document.addEventListener('keydown', e=>{
  const k = e.key;
  if(k==='ArrowUp'){ e.preventDefault(); press('up'); }
  else if(k==='ArrowDown'){ e.preventDefault(); press('down'); }
  else if(k==='ArrowLeft'){ e.preventDefault(); press('left'); }
  else if(k==='ArrowRight'){ e.preventDefault(); press('right'); }
  else if(k==='Enter'){ e.preventDefault(); press('ok'); }
  else if(k==='Backspace' || k==='Escape'){ e.preventDefault(); press('back'); }
  else if(k==='h' || k==='H'){ press('home'); }
});

for(const id of ['pinSwitch','largeSwitch']){
  $(id).addEventListener('click', ()=>{
    const el = $(id);
    el.setAttribute('aria-pressed', el.getAttribute('aria-pressed')==='true' ? 'false' : 'true');
  });
}
$('approveBtn').addEventListener('click', ()=>applyAdaptations(state.phase==='adapt'));
$('dismissBtn').addEventListener('click', ()=>{
  state.decision = 'dismissed';
  hideSuggestion();
  const sug = state.pendingSuggestion;
  recordAdaptation({ kind:'suggestion', status:'dismissed',
    label:'Suggestion dismissed' + (sug ? ' (' + sug.dest.name + ' shortcut)' : ''),
    evidence: sug ? sug.evidence.join(' \u00B7 ') : 'Dismissed at suggestion card.' });
  logEvent('Suggestion dismissed — nothing was changed. The dismissal is in your audit trail; AccessFlow only adapts with approval.', 'guide');
  if(state.phase==='adapt') startTask2();
  updateAll();
});
$('adaptList').addEventListener('click', e=>{
  const btn = e.target.closest ? e.target.closest('[data-undo]') : null;
  if(btn) undoAdaptation(Number(btn.getAttribute('data-undo')));
});
$('recoverBtn').addEventListener('click', ()=>{
  const info = nextStepInfo();
  if(!info) return;
  if(info.final){ press('ok', true); }
  else {
    const st = info.step;
    if(st.action.kind==='move') press(st.action.dir, true);
    else if(st.action.kind==='select') press('ok', true);
    else if(st.action.kind==='back') press('back', true);
    else press('home', true);
  }
  logEvent('Guided step taken for you along the optimal path.', 'guide');
  if(!currentTarget() || !$('recoverCard').classList.contains('show')) hideRecover();
  refreshRecoverText();
  updateAll();
});
$('recoverDismiss').addEventListener('click', ()=>{
  hideRecover();
  state.recoverCooldownUntil = performance.now() + 25000;
  logEvent('Recovery dismissed — you kept control. It can return if the struggle continues.', 'guide');
});
$('restartBtn').addEventListener('click', ()=>location.reload());

/* idle watcher: hesitation-prone stillness + recovery offer */
setInterval(()=>{
  if(run && run.active && run.started){
    $('mTime').textContent = fmt(performance.now() - run.startT);
    const idle = performance.now() - run.lastPressT;
    if(idle > 12000 && run.events >= 1 && performance.now() > state.recoverCooldownUntil &&
       !$('recoverCard').classList.contains('show')){
      state.recoverCooldownUntil = performance.now() + 30000;
      showRecover('No press for ' + Math.round(idle/1000) + ' seconds — the next step was not obvious.');
    }
  }
}, 600);

/* clock */
function tickClock(){
  const d = new Date();
  $('tvClock').textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
tickClock();
setInterval(tickClock, 20000);

/* init */
run.optStart = optimalFromHomeFor('subtitles:sub_toggle');
if(!run.pathSeq.length) run.pathSeq.push(nodeKey());
setTaskCard('Task 1 of 2 · Baseline run', 'Turn on Subtitles',
  'Use the remote below to navigate the TV: Home → Settings → Accessibility → Subtitles → switch On. AccessFlow is watching how the journey feels — every press is measured.',
  routeLine());
updateAll();
