/* AccessFlow engine — weighted navigation graph, Dijkstra path optimisation,
   difficulty-driven edge re-weighting, and the adaptive Fire TV UI state. */
"use strict";
/* ================= AccessFlow engine =================
   The TV interface is modelled as a weighted graph:
   node = (screen, focused item). Edges = remote presses
   (moves, Select, Back, Home). Dijkstra finds the optimal
   route; observed difficulty re-weights edges live.      */

const ICONS = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>',
  film:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
  tv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/></svg>',
  apps:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.14-1.4l2.1-1.63-2-3.46-2.49 1a7 7 0 0 0-2.42-1.4L13.66 2.6h-3.32l-.39 2.51a7 7 0 0 0-2.42 1.4l-2.49-1-2 3.46L5.14 10.6A7 7 0 0 0 5 12c0 .48.05.94.14 1.4L3.04 15l2 3.46 2.49-1a7 7 0 0 0 2.42 1.4l.39 2.5h3.32l.39-2.5a7 7 0 0 0 2.42-1.4l2.49 1 2-3.46-2.1-1.6c.09-.46.14-.92.14-1.4z"/></svg>',
  cc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17.5 10.2a2.4 2.4 0 1 0 0 3.6"/></svg>',
  contrast:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
  text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  ear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 10a6 6 0 1 1 9.5 5.3c-1 .8-1.6 1.4-2 2.4-.4 1.1-1.2 1.8-2.5 1.8a3.4 3.4 0 0 1-3.4-3.4c0-.7.2-1.2.5-1.9.4-.9.6-1.5.6-2.2a2.9 2.9 0 1 0-2.7-2.9"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.8v14.4c0 .9 1 1.5 1.8 1L20 13a1.2 1.2 0 0 0 0-2L8.8 3.9C8 3.4 7 4 7 4.8z"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  speaker:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.4 9.4 0 0 1 0 13"/></svg>',
  wifi:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.6 16a6 6 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg>',
  display:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.5S3.5 15.4 3.5 9.3A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.5 2.6c0 6.1-8.5 11.2-8.5 11.2z"/></svg>',
  music:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  photo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l1.2-3h13.6L20 7M4 7h16v3a2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 9.4 10 2.7 2.7 0 0 1 4 10zM6 12.5V20h12v-7.5"/></svg>'
};

const MOVIES = [
  {id:'riverrun',    title:'River Run',      meta:'Adventure · 2024 · 1h 52m', hue:197},
  {id:'desertlight', title:'Desert Light',   meta:'Drama · 2023 · 2h 05m',     hue:33},
  {id:'nightcircuit',title:'Night Circuit',  meta:'Thriller · 2024 · 1h 41m',  hue:262},
  {id:'harborsky',   title:'Harbor Sky',     meta:'Romance · 2022 · 1h 58m',   hue:214},
  {id:'emberfalls',  title:'Ember Falls',    meta:'Fantasy · 2024 · 2h 12m',   hue:14},
  {id:'lastsignal',  title:'The Last Signal',meta:'Sci-Fi · 2023 · 2h 01m',    hue:158}
];
const SHOWS = [
  {id:'signalhill', title:'Signal Hill', meta:'Drama series · 2 seasons',    hue:122},
  {id:'theorchard',  title:'The Orchard',  meta:'Comedy series · 3 seasons',   hue:84},
  {id:'northline',   title:'North Line',   meta:'Documentary · 1 season',      hue:200}
];

const state = {
  screen:'home', focusId:'search',
  navStack: [],
  detail:null,            // {id,title,meta,hue,kind}
  playing:false,
  settings:{ subtitles:false, highContrast:false, textSize:'Standard', voiceGuide:false,
             dialogueBoost:false, wifi:true, brightness:'Medium', resolution:'1080p',
             volume:'Medium', subSize:'Medium', subStyle:'Default' },
  adapted:{ pins:[], large:false },   // pins: destination ids with a pinned Home shortcut
  decision:null,          // null | 'approved' | 'dismissed'
  suggestionShown:false,
  weights:{},             // edgeKey -> added weight (learned difficulty bumps)
  edgeOutcomes:{},        // actionClass -> {traversals, errors} for the per-user difficulty multiplier
  destStats:{},           // destId -> {visits, totalPresses, totalExcess, difficultyEvents}
  prefixCounts:{},        // learned: path-prefix key -> {destId: count} from completed runs
  adaptations:[],         // audit trail: {id, kind, destId, label, evidence, time, status}
  pendingSuggestion:null, // data behind the currently displayed suggestion card
  currentPrediction:null, // last goal prediction used by the recovery card
  phase:'task1',          // task1 | adapt | task2 | results | task3 | done
  recoverCooldownUntil:0
};

let run = null;           // active run record
const results = { run1:null, run2:null };
const pageStart = performance.now();

function freshRun(task){
  return { task:task, active:true, started:false, startT:0, endT:0, lastPressT:0,
           presses:0, errors:0, backtracks:0, reversals:0, hesitations:0, events:0,
           lastDir:null, selectSince:true, visited:new Set(),
           pathSeq:[],              // ordered node keys visited this run (for goal prediction)
           destId:(task==='task3' ? 'riverrun' : 'subtitles'),
           optStart:null };         // optimal presses from Home at run start (for excess cost)
}
run = freshRun('task1');

/* ---------------- screen definitions ---------------- */
/* ---------------- destinations & shortcut discovery ----------------
   A destination is anything a user repeatedly travels to. Shortcut
   discovery (below) is purely data-driven: it ranks destinations from
   measured run statistics, it is not aimed at any pre-chosen target. */
function pinTileId(destId){ return destId==='subtitles' ? 'sub_shortcut' : 'pin_' + destId; }

const DESTINATIONS = [
  { id:'subtitles', name:'Subtitles', node:'subtitles:sub_toggle',
    tile:()=>({ id:pinTileId('subtitles'), label:'Subtitles', sub:'Your shortcut', icon:'cc',
                shortcut:true, action:{type:'nav', to:'subtitles'} }) },
  { id:'riverrun', name:"River Run (Play)", node:'detail:play',
    tile:()=>({ id:pinTileId('riverrun'), label:'River Run', sub:'Your shortcut · Movie', poster:MOVIES[0],
                shortcut:true, action:{type:'openDetail', movie:MOVIES[0], kind:'Movie'} }) }
];
function destinationById(id){ return DESTINATIONS.find(d=>d.id===id) || null; }

function homeItems(){
  const items = [];
  let y = 0;
  if(state.adapted.pins.length){
    state.adapted.pins.forEach((destId, i)=>{
      const dest = destinationById(destId);
      if(dest) items.push(Object.assign(dest.tile(), {x:i%3, y:Math.floor(i/3)}));
    });
    y = Math.ceil(state.adapted.pins.length / 3);
  }
  const rowA = [
    {id:'search', label:'Search',   icon:'search', action:{type:'noop', msg:'Search is decorative in this prototype — the route that matters today is Settings.'}},
    {id:'movies', label:'Movies',   icon:'film',   action:{type:'nav', to:'movies'}},
    {id:'shows',  label:'TV Shows', icon:'tv',     action:{type:'nav', to:'shows'}}
  ];
  const rowB = [
    {id:'apps',     label:'Apps',     icon:'apps', action:{type:'nav', to:'apps'}},
    {id:'settings', label:'Settings', icon:'gear', action:{type:'nav', to:'settings'}}
  ];
  rowA.forEach((it,i)=>items.push(Object.assign({}, it, {x:i, y:y})));
  rowB.forEach((it,i)=>items.push(Object.assign({}, it, {x:i, y:y+1})));
  return items;
}

function getScreens(){
  const S = state.settings;
  const screens = {
    home:{ title:'Home', layout:'grid', cols:3, hint:'', items: homeItems() },
    movies:{ title:'Movies', layout:'grid', cols:3, hint:'Pick a movie to open its page.',
      items: MOVIES.map((m,i)=>({id:m.id, label:m.title, sub:m.meta, poster:m, x:i%3, y:Math.floor(i/3),
              action:{type:'openDetail', movie:m, kind:'Movie'}})) },
    shows:{ title:'TV Shows', layout:'grid', cols:3, hint:'Pick a show to open its page.',
      items: SHOWS.map((m,i)=>({id:m.id, label:m.title, sub:m.meta, poster:m, x:i, y:0,
              action:{type:'openDetail', movie:m, kind:'Series'}})) },
    apps:{ title:'Apps', layout:'grid', cols:2, hint:'Your installed apps.',
      items: [
        {id:'streambox', label:'StreamBox',  sub:'Streaming', icon:'play',  x:0, y:0, action:{type:'noop', msg:'StreamBox is not part of this demo — press Back to keep exploring.'}},
        {id:'wavetunes', label:'WaveTunes',  sub:'Music',     icon:'music', x:1, y:0, action:{type:'noop', msg:'WaveTunes is not part of this demo — press Back to keep exploring.'}},
        {id:'photowall', label:'PhotoWall',  sub:'Photos',    icon:'photo', x:0, y:1, action:{type:'noop', msg:'PhotoWall is not part of this demo — press Back to keep exploring.'}},
        {id:'appstore',  label:'App Store',  sub:'Get more apps', icon:'store', x:1, y:1, action:{type:'noop', msg:'The App Store is not part of this demo — press Back to keep exploring.'}}
      ]},
    settings:{ title:'Settings', layout:'grid', cols:2, hint:'', items: [
        {id:'accessibility', label:'Accessibility', sub:'Subtitles, contrast, text', icon:'heart',   x:0, y:0, action:{type:'nav', to:'accessibility'}},
        {id:'display',       label:'Display',       sub:'Brightness, resolution',    icon:'display', x:1, y:0, action:{type:'nav', to:'display'}},
        {id:'audio',         label:'Audio',         sub:'Volume, dialogue',          icon:'speaker', x:0, y:1, action:{type:'nav', to:'audio'}},
        {id:'network',       label:'Network',       sub:'Wi-Fi',                       icon:'wifi',    x:1, y:1, action:{type:'nav', to:'network'}}
      ]},
    accessibility:{ title:'Accessibility', layout:'list', hint:'', items: [
        {id:'subtitles',    label:'Subtitles',    sub:'Captions for shows and movies', icon:'cc',       x:0, y:0, action:{type:'nav', to:'subtitles'}},
        {id:'highcontrast', label:'High Contrast', sub:'Stronger colours and outlines', icon:'contrast', x:0, y:1, val:()=>S.highContrast?'On':'Off', action:{type:'toggle', key:'highContrast', name:'High Contrast'}},
        {id:'textsize',     label:'Text Size',     sub:'Size of on-screen text',        icon:'text',     x:0, y:2, val:()=>S.textSize, action:{type:'cycle', key:'textSize', values:['Standard','Large','Extra Large'], name:'Text size'}},
        {id:'voiceguide',   label:'Voice Guide',   sub:'Speaks menus aloud',          icon:'ear',      x:0, y:3, val:()=>S.voiceGuide?'On':'Off', action:{type:'toggle', key:'voiceGuide', name:'Voice Guide'}}
      ]},
    subtitles:{ title:'Subtitles', layout:'list', hint:'', items: [
        {id:'sub_toggle', label:'Subtitles', sub:'Show captions while watching', icon:'cc', x:0, y:0, val:()=>S.subtitles?'On':'Off', action:{type:'toggle', key:'subtitles', name:'Subtitles'}},
        {id:'sub_size',   label:'Caption Size', sub:'', icon:'text', x:0, y:1, val:()=>S.subSize, action:{type:'cycle', key:'subSize', values:['Small','Medium','Large'], name:'Caption size'}},
        {id:'sub_style',  label:'Caption Style', sub:'', icon:'contrast', x:0, y:2, val:()=>S.subStyle, action:{type:'cycle', key:'subStyle', values:['Default','Outline','Shadow'], name:'Caption style'}}
      ]},
    display:{ title:'Display', layout:'list', hint:'', items: [
        {id:'brightness', label:'Brightness', icon:'sun', x:0, y:0, val:()=>S.brightness, action:{type:'cycle', key:'brightness', values:['Low','Medium','High'], name:'Brightness'}},
        {id:'resolution', label:'Resolution', icon:'display', x:0, y:1, val:()=>S.resolution, action:{type:'cycle', key:'resolution', values:['1080p','4K'], name:'Resolution'}}
      ]},
    audio:{ title:'Audio', layout:'list', hint:'', items: [
        {id:'volume', label:'Volume', icon:'speaker', x:0, y:0, val:()=>S.volume, action:{type:'cycle', key:'volume', values:['Low','Medium','High'], name:'Volume'}},
        {id:'boost',  label:'Dialogue Boost', sub:'Makes speech clearer', icon:'ear', x:0, y:1, val:()=>S.dialogueBoost?'On':'Off', action:{type:'toggle', key:'dialogueBoost', name:'Dialogue Boost'}}
      ]},
    network:{ title:'Network', layout:'list', hint:'', items: [
        {id:'wifi', label:'Wi-Fi', sub:'HomeWiFi', icon:'wifi', x:0, y:0, val:()=>S.wifi?'On':'Off', action:{type:'toggle', key:'wifi', name:'Wi-Fi'}},
        {id:'netstatus', label:'Connection Status', icon:'wifi', x:0, y:1, val:()=>'Connected', action:{type:'noop', msg:'Connected to HomeWiFi · signal strong.'}}
      ]},
    detail:{ title: state.detail ? state.detail.title : 'Details', layout:'detail', items: [
        {id:'play',      label: state.detail && state.detail.kind==='Series' ? 'Play Episode 1' : 'Play', icon:'play', x:0, y:0, action:{type:'play'}},
        {id:'watchlist', label:'Add to Watchlist', icon:'heart', x:1, y:0, action:{type:'noop', msg:'Added to your Watchlist.'}}
      ]},
    player:{ title:'Now Playing', layout:'player', items: [
        {id:'playpause', label:'Pause', icon:'play', x:0, y:0, action:{type:'playpause'}}
      ]}
  };
  return screens;
}

const PARENT = { movies:'home', shows:'home', apps:'home', settings:'home', detail:'movies',
                 accessibility:'settings', display:'settings', audio:'settings',
                 network:'settings', subtitles:'accessibility', player:'detail' };
const ENTRY_ITEM = { movies:'movies', shows:'shows', apps:'apps', settings:'settings',
                     accessibility:'accessibility', display:'display', audio:'audio',
                     network:'network', subtitles:'subtitles', player:'play' };

function defaultFocus(screenId){ const d = getScreens()[screenId]; return d.items[0].id; }
function currentDef(){ return getScreens()[state.screen]; }
function currentItem(){ return currentDef().items.find(i=>i.id===state.focusId) || currentDef().items[0]; }
function nodeKey(screen, item){ return (screen||state.screen) + ':' + (item||state.focusId); }

function neighborFor(items, item, dir){
  let best = null, bestScore = Infinity;
  for(const it of items){
    if(it.id===item.id) continue;
    let primary, perp;
    if(dir==='right'){ if(it.x<=item.x) continue; primary = it.x-item.x; perp = Math.abs(it.y-item.y); }
    if(dir==='left'){  if(it.x>=item.x) continue; primary = item.x-it.x; perp = Math.abs(it.y-item.y); }
    if(dir==='down'){  if(it.y<=item.y) continue; primary = it.y-item.y; perp = Math.abs(it.x-item.x); }
    if(dir==='up'){    if(it.y>=item.y) continue; primary = item.y-it.y; perp = Math.abs(it.x-item.x); }
    const score = primary*10 + perp;
    if(score < bestScore){ bestScore = score; best = it; }
  }
  return best;
}

/* ---------------- effort model (Fitts's law + learned difficulty) ----------------
   Weighted edge cost, honestly labelled in the UI and docs:
     weight = ( PRESS_BASE + fitts ) x difficultyMultiplier + learnedBump
     fitts  = log2( distanceSteps / targetSize + 1 )     (Fitts's law, Shannon form)
   - distanceSteps: grid distance in focus steps between the two tiles
     (1 for Select/Back/Home, which act on the already-focused target).
   - targetSize: per-item size factor — posters/list rows are bigger than
     small grid tiles; enlarged-focus mode multiplies every size, which
     measurably lowers the Fitts component.
   - difficultyMultiplier: 1 + this user's measured error rate for that
     action class (moves left, moves right, selects, ...), updated live
     from traversals vs difficulty events.
   - learnedBump: additive weight added to a specific edge whenever a
     difficulty event happens on it (the original re-weighting behaviour).
   Unweighted cost is always exactly 1 per press, so "optimal presses"
   stays a pure, honest press count.                                        */
const PRESS_BASE = 1;

function itemSizeFactor(item){
  if(!item) return 1;
  if(item.poster) return 1.35;              // movie/show posters are large targets
  if(item.shortcut) return 1.3;             // pinned shortcuts are prominent tiles
  return 1;
}
function effectiveTargetSize(item, largeMode){
  let s = itemSizeFactor(item);
  if(item && item._listRow) s *= 1.15;      // full-width list rows are easier to land on
  if(largeMode) s *= 1.5;                   // enlarged-focus mode: bigger targets, lower cost
  return s;
}
function fittsCost(distanceSteps, targetSize){
  const d = Math.max(0, distanceSteps || 0);
  const s = Math.max(0.05, targetSize || 1);
  return Math.log2(d / s + 1);
}
function actionClass(action){ return action.kind + (action.dir || ''); }
function difficultyMultiplier(action){
  const st = state.edgeOutcomes[actionClass(action)];
  if(!st || !st.traversals) return 1;
  const rate = st.errors / st.traversals;             // this user's error rate on similar edges
  return 1 + Math.min(0.9, rate);
}
function combineWeight(fitts, multiplier, learnedBump){
  return (PRESS_BASE + fitts) * multiplier + (learnedBump || 0);
}
function noteTraversal(action){
  const c = actionClass(action);
  const st = state.edgeOutcomes[c] || (state.edgeOutcomes[c] = {traversals:0, errors:0});
  st.traversals++;
}
function noteEdgeError(action){
  const c = actionClass(action);
  const st = state.edgeOutcomes[c] || (state.edgeOutcomes[c] = {traversals:0, errors:0});
  st.errors++;
}
function isReversal(prevDir, dir, selectSince, oppMap){
  return !!(prevDir && oppMap[prevDir]===dir && !selectSince);
}
function fittsForEdge(edge){
  if(!edge) return 0;
  if(edge.action.kind==='move' && edge.fromItem && edge.toItem){
    const d = Math.abs(edge.toItem.x - edge.fromItem.x) + Math.abs(edge.toItem.y - edge.fromItem.y);
    return fittsCost(Math.max(1, d), effectiveTargetSize(edge.toItem, state.adapted.large));
  }
  // Select / Back / Home act on the focused item: nominal 1-step acquisition.
  return fittsCost(1, effectiveTargetSize(edge.fromItem, state.adapted.large));
}
function userErrorRate(){
  let t = 0, e = 0;
  for(const c of Object.values(state.edgeOutcomes)){ t += c.traversals; e += c.errors; }
  return t ? e / t : 0;
}

/* ---------------- graph + Dijkstra ---------------- */
function buildGraph(){
  const screens = getScreens();
  const adj = {};
  const itemOf = (sid, iid)=>{ const d = screens[sid]; return d ? (d.items.find(i=>i.id===iid) || d.items[0]) : null; };
  const add = (from, to, action, fromItem, toItem)=>{
    (adj[from] = adj[from] || []).push({to:to, action:action, fromItem:fromItem||null, toItem:toItem||null});
  };
  for(const sid of Object.keys(screens)){
    const def = screens[sid];
    const isList = def.layout==='list';
    for(const rawItem of def.items){
      const item = isList ? Object.assign({}, rawItem, {_listRow:true}) : rawItem;
      const key = sid + ':' + item.id;
      for(const dir of ['up','down','left','right']){
        const nb = neighborFor(def.items, item, dir);
        if(nb) add(key, sid + ':' + nb.id, {kind:'move', dir:dir}, item, isList ? Object.assign({}, nb, {_listRow:true}) : nb);
      }
      const a = item.action;
      if(a.type==='nav')        add(key, a.to + ':' + defaultFocus(a.to), {kind:'select'}, item, itemOf(a.to, defaultFocus(a.to)));
      else if(a.type==='openDetail') add(key, 'detail:play', {kind:'select'}, item, itemOf('detail','play'));
      else if(a.type==='play')  add(key, 'player:playpause', {kind:'select'}, item, itemOf('player','playpause'));
      else                      add(key, key, {kind:'select'}, item, item);
      if(PARENT[sid]){
        const p = PARENT[sid];
        let entry = ENTRY_ITEM[sid];
        if(sid==='detail') entry = state.detail ? state.detail.id : 'riverrun';
        if(sid==='subtitles' && p==='accessibility') entry = 'subtitles';
        add(key, p + ':' + entry, {kind:'back'}, item, itemOf(p, entry));
      }
      if(sid!=='home') add(key, 'home:' + defaultFocus('home'), {kind:'home'}, item, itemOf('home', defaultFocus('home')));
    }
  }
  return adj;
}

function edgeWeight(from, action, weighted, edge){
  if(!weighted) return 1;
  const learned = state.weights[from + '|' + actionClass(action)] || 0;
  return combineWeight(fittsForEdge(edge), difficultyMultiplier(action), learned);
}
function bumpWeight(fromKey, action){
  const k = fromKey + '|' + actionClass(action);
  state.weights[k] = (state.weights[k]||0) + 0.6;
  noteEdgeError(action);
}

/* Pure Dijkstra core over an adjacency map {node: [{to, action, ...}]},
   with weightFn(fromNode, edge) -> number. The app-facing dijkstra()
   below is a thin wrapper that builds the live graph and plugs in the
   effort model. The test suite exercises THIS function directly. */
function dijkstraCore(adj, start, target, weightFn){
  const dist = {}, prev = {}, Q = new Set([start]);
  dist[start] = 0;
  while(Q.size){
    let u = null, best = Infinity;
    for(const n of Q){ if(dist[n] < best){ best = dist[n]; u = n; } }
    if(u===null) break;
    Q.delete(u);
    if(u===target) break;
    for(const e of (adj[u]||[])){
      const w = weightFn(u, e);
      const nd = dist[u] + w;
      if(dist[e.to]===undefined || nd < dist[e.to]){
        dist[e.to] = nd; prev[e.to] = {from:u, action:e.action}; Q.add(e.to);
      }
    }
  }
  if(dist[target]===undefined) return {dist:Infinity, path:[]};
  const path = [];
  let cur = target;
  while(cur!==start){
    const p = prev[cur]; if(!p) break;
    path.unshift({from:p.from, to:cur, action:p.action});
    cur = p.from;
  }
  return { dist:dist[target], path:path };
}

function dijkstra(start, target, weighted){
  const adj = buildGraph();
  return dijkstraCore(adj, start, target, (u, e)=>edgeWeight(u, e.action, weighted, e));
}

/* ---------------- shortcut discovery (data-driven) ----------------
   Ranks destinations from measured run statistics:
     score = visits x average excess presses per visit   (= total excess)
   A destination is a candidate when it is not already pinned and it
   either cost the user excess presses or a pin would shorten its
   optimal route by at least 2 presses. Nothing here knows in advance
   which destination "should" win — the demo's Subtitles result falls
   out of the numbers, and a costly movie routine would win instead.  */
function optimalFromHomeFor(node){
  return dijkstra('home:' + defaultFocus('home'), node, false).dist + 1;
}
function optimalWithPinFor(dest){
  const saved = state.adapted.pins.slice();
  if(!saved.includes(dest.id)) state.adapted.pins = saved.concat(dest.id);
  const v = optimalFromHomeFor(dest.node);
  state.adapted.pins = saved;
  return v;
}
function rankShortcutCandidates(stats, pinnedIds){
  const pinned = pinnedIds || [];
  const out = [];
  for(const dest of DESTINATIONS){
    if(pinned.includes(dest.id)) continue;
    const s = stats[dest.id] || {visits:0, totalPresses:0, totalExcess:0, difficultyEvents:0};
    const avgExcess = s.visits ? s.totalExcess / s.visits : 0;
    const score = s.visits * avgExcess;
    const optNow = optimalFromHomeFor(dest.node);
    const optPinned = optimalWithPinFor(dest);
    const saving = optNow - optPinned;
    if(score > 0 || saving >= 2)
      out.push({ dest:dest, visits:s.visits, totalPresses:s.totalPresses, totalExcess:s.totalExcess,
                 difficultyEvents:s.difficultyEvents, avgExcess:avgExcess, score:score,
                 optNow:optNow, optPinned:optPinned, saving:saving });
  }
  out.sort((a,b)=> (b.score - a.score) || (b.saving - a.saving));
  return out;
}

/* ---------------- goal prediction (prefix-based, algorithmic) ----------------
   Predicts the user's likely destination from:
   (a) PREFIX evidence — how much of each destination's canonical route
       (its Dijkstra path from Home) the user's path so far follows, in
       order (a subsequence match, so overshoot detours don't break it);
   (b) LEARNED prefixes — prefix->destination counts recorded from this
       user's own completed runs;
   (c) HISTORY prior — how often the user has visited each destination.
   This is transparent counting/statistics over the graph — it is NOT
   an LLM and makes no language-model claim anywhere.                  */
function canonicalRouteNodes(dest){
  const res = dijkstra('home:' + defaultFocus('home'), dest.node, false);
  const nodes = ['home:' + defaultFocus('home')];
  for(const st of res.path) nodes.push(st.to);
  return nodes;
}
/* Route coverage: longest-common-subsequence length between the
   destination's canonical route and the user's actual path, divided
   by the canonical route length. LCS (not a strict prefix match) so
   that an overshoot detour early on does not zero out the evidence —
   what matters is how much of the usual route the user has covered,
   in order. */
function subsequenceRatio(canonical, actual){
  if(!canonical.length || !actual.length) return 0;
  let prev = new Array(actual.length + 1).fill(0);
  for(let i = 1; i <= canonical.length; i++){
    const cur = new Array(actual.length + 1).fill(0);
    for(let j = 1; j <= actual.length; j++)
      cur[j] = canonical[i-1] === actual[j-1] ? prev[j-1] + 1 : Math.max(prev[j], cur[j-1]);
    prev = cur;
  }
  return prev[actual.length] / canonical.length;
}
function predictGoal(pathSeq, stats, prefixCounts){
  const totalVisits = DESTINATIONS.reduce((a,d)=> a + ((stats[d.id]||{}).visits || 0), 0);
  const prefixKey = (pathSeq || []).join('>');
  const learnedForPrefix = (prefixCounts && prefixKey) ? (prefixCounts[prefixKey] || null) : null;
  const learnedTotal = learnedForPrefix ? Object.values(learnedForPrefix).reduce((a,b)=>a+b,0) : 0;
  const scored = DESTINATIONS.map(dest=>{
    const canon = canonicalRouteNodes(dest);
    const prefixScore = subsequenceRatio(canon, pathSeq || []);
    const histScore = totalVisits ? ((stats[dest.id]||{}).visits || 0) / totalVisits : 0;
    const learnScore = learnedTotal ? ((learnedForPrefix[dest.id] || 0) / learnedTotal) : 0;
    const raw = 0.5 * prefixScore + 0.3 * histScore + 0.2 * learnScore;
    return { dest:dest, prefixScore:prefixScore, histScore:histScore, learnScore:learnScore, raw:raw };
  });
  const totalRaw = scored.reduce((a,s)=>a+s.raw, 0);
  for(const s of scored) s.prob = totalRaw ? s.raw / totalRaw : 1 / scored.length;
  scored.sort((a,b)=> b.prob - a.prob);
  return scored;
}
function learnPrefixes(pathSeq, destId){
  if(!pathSeq || !pathSeq.length) return;
  for(let n = 1; n <= pathSeq.length; n++){
    const key = pathSeq.slice(0, n).join('>');
    const bucket = state.prefixCounts[key] || (state.prefixCounts[key] = {});
    bucket[destId] = (bucket[destId] || 0) + 1;
  }
}

function currentTarget(){
  if(state.phase==='task1' || state.phase==='task2')
    return { screen:'subtitles', itemId:'sub_toggle', node:'subtitles:sub_toggle',
             name:'Subtitles', finalChip:'OK · Subtitles On' };
  if(state.phase==='task3')
    return { screen:'detail', itemId:'play', node:'detail:play',
             name:"Play 'River Run'", finalChip:'OK · Play' };
  return null;
}

/* ---------------- rendering: TV ---------------- */
const $ = id => document.getElementById(id);
const tvBody = $('tvBody'), tvScreenEl = $('tvScreen');

function posterHTML(m, big){
  return '<div class="' + (big?'detail-poster':'poster') + '" style="background:linear-gradient(135deg,hsl(' + m.hue + ',52%,34%),hsl(' + ((m.hue+40)%360) + ',55%,20%))">' +
         m.title.split(' ').map(w=>w[0]).join('').slice(0,2) + '</div>';
}
function itemInner(it){
  let h = '';
  if(it.poster) h += posterHTML(it.poster, false);
  else if(it.icon) h += '<span class="ic">' + ICONS[it.icon] + '</span>';
  h += '<span class="lbl">' + it.label + '</span>';
  if(it.sub) h += '<span class="sub">' + it.sub + '</span>';
  if(it.val) h += '<span class="val">' + it.val() + '</span>';
  return h;
}
function renderTV(){
  const def = currentDef();
  $('tvScreenName').textContent = state.screen==='player' && state.detail ? state.detail.title : def.title;
  $('adaptBadge').hidden = !(state.adapted.pins.length || state.adapted.large);
  $('ccBadge').hidden = !state.settings.subtitles;
  tvScreenEl.classList.toggle('hc', state.settings.highContrast);
  tvScreenEl.classList.toggle('large', state.adapted.large);
  tvScreenEl.classList.toggle('ts-large', state.settings.textSize==='Large');
  tvScreenEl.classList.toggle('ts-xl', state.settings.textSize==='Extra Large');

  let html = '';
  if(def.layout==='grid'){
    if(def.hint) html += '<p class="tv-hint">' + def.hint + '</p>';
    html += '<div class="tiles cols' + def.cols + '">';
    for(const it of def.items)
      html += '<div class="tile' + (it.id===state.focusId?' focused':'') + (it.shortcut?' shortcut':'') + '" data-id="' + it.id + '">' + itemInner(it) + '</div>';
    html += '</div>';
  } else if(def.layout==='list'){
    html += '<div class="list">';
    for(const it of def.items)
      html += '<div class="row-item' + (it.id===state.focusId?' focused':'') + '" data-id="' + it.id + '">' +
              (it.icon ? '<span class="ic">' + ICONS[it.icon] + '</span>' : '') +
              '<span><span class="lbl">' + it.label + '</span>' +
              (it.sub ? '<br><span class="sub">' + it.sub + '</span>' : '') + '</span>' +
              (it.val ? '<span class="val">' + it.val() + '</span>' : '') + '</div>';
    html += '</div>';
  } else if(def.layout==='detail'){
    const d = state.detail || MOVIES[0];
    html += '<div class="detail-head">' + posterHTML(d, true) +
            '<div><h4>' + d.title + '</h4><p>' + d.meta + '</p><p>' + (d.kind||'Movie') + ' · Ready when you are</p></div></div>';
    html += '<div class="tiles cols2">';
    for(const it of def.items)
      html += '<div class="tile' + (it.id===state.focusId?' focused':'') + '" data-id="' + it.id + '">' + itemInner(it) + '</div>';
    html += '</div>';
  } else if(def.layout==='player'){
    const d = state.detail || MOVIES[0];
    const focused = state.focusId==='playpause';
    html += '<div class="playerbox"><div class="pbtn" style="' + (focused?'transform:scale(1.1);box-shadow:0 0 0 4px rgba(255,180,58,.35);':'') + '">' +
            (state.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
                           : ICONS.play) + '</div>' +
            '<div style="font-size:19px;font-weight:800;">' + d.title + '</div>' +
            '<div style="color:var(--muted);font-size:13px;">' + (state.playing?'Now playing':'Paused') + (state.settings.subtitles?' · Captions on':'') + '</div>' +
            '<div class="progress"><i style="width:' + (state.playing?'46%':'34%') + '"></i></div>' +
            '<div style="color:var(--faint);font-size:12px;">OK = ' + (state.playing?'Pause':'Play') + ' · Back = movie page</div></div>';
  }
  tvBody.innerHTML = html;
  const f = tvBody.querySelector('.focused');
  if(f && f.scrollIntoView) f.scrollIntoView({block:'nearest'});
}

let toastTimer = null;
function toast(msg){
  const t = $('tvToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2300);
}
