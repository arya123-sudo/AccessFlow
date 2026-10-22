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
  $('engineLine').innerHTML = 'Graph engine: <b>' + nodes + ' nodes · ' + edges + ' edges</b> · Dijkstra live · ' +
    Object.keys(state.weights).length + ' learned weight' + (Object.keys(state.weights).length===1?'':'s');
}

function updateAll(){ renderTV(); renderMetrics(); renderPath(); refreshRecoverText(); }

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
  if(!guided && run && run.active){
    if(run.lastDir && OPP[run.lastDir]===dir && !run.selectSince){
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
  if(run && run.active){ run.selectSince = true; run.lastDir = null; }
  if(!guided && run && run.active)
    addEvent('backtrack', 'Backtrack — pressed Back to ' + screenTitle(dest.screen) + '.');
}

function doHome(guided){
  state.navStack = [];
  state.screen = 'home';
  state.focusId = defaultFocus('home');
  if(state.playing) state.playing = false;
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

  if(!guided && run && run.active){ run.selectSince = true; run.lastDir = null; }

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
  updateAll();
}

/* ---------------- suggestion (adaptation) ---------------- */
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
  const tgt = { node:'subtitles:sub_toggle' };
  return dijkstra('home:' + defaultFocus('home'), tgt.node, false).dist + 1;
}
function showSuggestion(reason){
  if(state.suggestionShown && reason==='threshold') return;
  state.suggestionShown = true;
  const card = $('suggestCard');
  const parts = findingsList();
  const optNow = optimalFromHome();
  // projected optimal with the pin, computed on a temporary graph state
  const wasPinned = state.adapted.pinned;
  state.adapted.pinned = true;
  const optPinned = optimalFromHome();
  state.adapted.pinned = wasPinned;
  $('pinEffect').textContent = 'Adds a direct Home → Subtitles route. Optimal path drops from ' + optNow + ' presses to ' + optPinned + '.';
  if(reason==='complete' && parts.length===0){
    $('suggestText').textContent = 'That was a clean run — no difficulties detected. AccessFlow still found a shorter route for next time:';
  } else if(reason==='complete'){
    $('suggestText').textContent = 'Run 1 is measured. Here is what AccessFlow detected along the way:';
  } else {
    $('suggestText').textContent = 'AccessFlow has detected enough friction to suggest a change:';
  }
  $('suggestFindings').innerHTML = parts.length
    ? '<ul>' + parts.map(p=>'<li>' + p + '</li>').join('') + '<li>' + run.presses + ' presses vs ' + optNow + ' optimal (from Home)</li></ul>'
    : '';
  card.classList.add('show');
  logEvent('AccessFlow suggested an adaptation — waiting for your decision. Nothing changes without approval.', 'guide');
  card.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function maybeSuggest(){
  if(state.phase!=='task1' || !run || !run.active) return;
  if(run.events >= 3 && !state.suggestionShown) showSuggestion('threshold');
}
function hideSuggestion(){ $('suggestCard').classList.remove('show'); }

function applyAdaptations(fromComplete){
  const pin = $('pinSwitch').getAttribute('aria-pressed')==='true';
  const large = $('largeSwitch').getAttribute('aria-pressed')==='true';
  state.adapted.pinned = pin;
  state.adapted.large = large;
  state.decision = (pin || large) ? 'approved' : 'dismissed';
  hideSuggestion();
  if(pin) logEvent('Approved: Subtitles shortcut pinned on Home. The graph gained a shorter edge.', 'good');
  if(large) logEvent('Approved: enlarged focus and targets are on.', 'good');
  if(!pin && !large) logEvent('No adaptations selected — layout stays standard.', 'guide');
  if(state.screen==='home' && pin) state.focusId = 'sub_shortcut';
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
function nextStepInfo(){
  const tgt = currentTarget();
  if(!tgt) return null;
  const cur = nodeKey();
  if(cur === tgt.node) return { final:true, text:'You are on the target — one OK press finishes it.' };
  const res = dijkstra(cur, tgt.node, false);
  if(!res.path.length) return null;
  const st = res.path[0];
  if(st.action.kind==='move') return { step:st, text:'Next step: move ' + ARROWS[st.action.dir] + ' to “' + itemLabel(st.to.split(':')[0], st.to.split(':')[1]) + '”.' };
  if(st.action.kind==='select') return { step:st, text:'Next step: press OK to open ' + screenTitle(st.to.split(':')[0]) + '.' };
  if(st.action.kind==='back') return { step:st, text:'Next step: press Back to return to ' + screenTitle(st.to.split(':')[0]) + '.' };
  return { step:st, text:'Next step: press Home.' };
}
function refreshRecoverText(){
  if(!$('recoverCard').classList.contains('show')) return;
  const info = nextStepInfo();
  const tgt = currentTarget();
  $('recoverTitle').textContent = tgt ? 'Looks like you\'re heading for ' + tgt.name.replace("Play 'River Run'", 'River Run') : 'Need a hand?';
  if(info) $('recoverText').textContent = ($('recoverText').dataset.reason || '') + ' ' + info.text + ' AccessFlow computed this from the live graph.';
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
                reversals:run.reversals, time:(run.endT - run.startT)/1000 };
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
  logEvent('Suggestion dismissed — nothing was changed. AccessFlow only adapts with approval.', 'guide');
  if(state.phase==='adapt') startTask2();
  updateAll();
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
setTaskCard('Task 1 of 2 · Baseline run', 'Turn on Subtitles',
  'Use the remote below to navigate the TV: Home → Settings → Accessibility → Subtitles → switch On. AccessFlow is watching how the journey feels — every press is measured.',
  routeLine());
updateAll();
