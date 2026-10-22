# AccessFlow — Architecture

## Overview
AccessFlow is an AI-assisted, self-adaptive navigation layer for Fire TV. Instead of a fixed menu tree, navigation is modelled as a **weighted graph** and continuously re-optimized around the individual user's measured difficulty. The system follows a strict loop:

**Detect → Optimize → Discover → Approve → Adapt (and Undo)**

No adaptation is ever applied without the user's explicit approval, and every applied or dismissed adaptation is recorded in an audit trail the user can inspect and revert.

## The navigation graph (`js/engine.js`)
- **Node** = a `(screen, focused item)` pair — e.g. `(settings, accessibility)`, `(accessibility, subtitles)`.
- **Edge** = one remote action: a D-pad move, **Select**, **Back**, or **Home**. Each edge carries its from/to items so costs can use real geometry.
- **Shortest path** = Dijkstra's algorithm over the current weighted graph, computed live (the pure core is `dijkstraCore(adj, start, target, weightFn)`; the app-facing `dijkstra()` builds the live graph and plugs in the effort model). The demo shows the optimal press count and route for the active task at all times (the built demo measured 38 nodes / 168 edges).

## The effort model (Fitts's law + learned difficulty)
Unweighted cost is always exactly **1 per press**, so "optimal presses" stays an honest press count. The *weighted* cost of an edge is:

```
weight = ( ( PRESS_BASE + fitts ) × difficultyMultiplier + learnedBump ) × profileMultiplier
fitts  = log2( distanceSteps / targetSize + 1 )        (Fitts's law, Shannon form)
```

- **distanceSteps** — grid distance in focus steps between the two tiles for move edges (Manhattan distance); `1` for Select/Back/Home, which act on the already-focused target.
- **targetSize** — a per-item size factor: movie/show posters `1.35`, pinned shortcut tiles `1.3`, full-width list rows `×1.15`, standard grid tiles `1.0`. **Enlarged-focus mode multiplies every size by 1.5**, which measurably lowers the Fitts component of every edge — this is computed, not cosmetic: the test suite asserts that a move edge costs less with enlarged mode on.
- **difficultyMultiplier** — `1 + this user's error rate` for that action class (`move:left`, `move:right`, `select`, …), where error rate = difficulty events ÷ traversals, both counted live (`noteTraversal` / `noteEdgeError` in `state.edgeOutcomes`). Capped at `1.9`.
- **learnedBump** — the original additive re-weighting: `+0.6` on the specific edge each time a difficulty event occurs on it (`state.weights`).
- **profileMultiplier** — the user's directional movement profile (next section): `×2.0` on move edges in the disfavoured direction, `×1.0` everywhere else (Select/Back/Home are direction-neutral and never multiplied).

The metrics panel displays the model honestly, including the user's current measured error rate, the active target-size factor, and the active movement profile with its multiplier.

### Directional movement profiles (user preference)
A movement profile is a **preference the user sets**, adopted from a teammate's parallel prototype — it is *not* an adaptation: AccessFlow never proposes or changes it, and it never appears in the adaptations audit trail. The three profiles are **Standard** (all moves ×1.0), **Reduce horizontal effort** (left/right moves ×2.0 in the weighted model), and **Reduce vertical effort** (up/down moves ×2.0), held in `state.movementProfile` and applied by `profileMultiplier()` inside `edgeWeight()` — weighted cost only. Unweighted cost stays exactly 1 per press under every profile, so press counts and all "optimal presses" figures are untouched. Because the weighted Dijkstra is what produces the panel's weighted-effort figure and the recovery card's next step, routing genuinely steers off the disfavoured axis when an alternate route exists (the test suite proves this on a two-route graph with equal press counts, where only the profile can break the tie). The control lives in the **Live metrics panel** — deliberately not as a row in the TV's Accessibility list, so the navigation graph and the verified demo routes are unchanged — and changing it writes a "Preference changed" line to the detection/event log.

## Difficulty detection (`js/app.js`)
Every press is logged with a timestamp and classified:
- **Overshoot / reversal** — moving in the exact opposite direction of the previous move with no intervening select (`isReversal`, a pure helper shared with the tests).
- **Backtrack** — pressing Back to leave a screen.
- **Wrong select** — selecting an item that does not reduce the Dijkstra distance to the goal.
- **Hesitation** — a pause of more than 4 s between presses mid-run.

## Shortcut discovery (data-driven, `rankShortcutCandidates`)
After every completed run, the run's measured record is folded into per-destination statistics (`state.destStats`): **visits, total presses, excess presses vs the Dijkstra optimal at run start, and difficulty events**. Candidates are then ranked by:

```
score = visits × average excess presses per visit   (= total excess presses)
```

A destination becomes a candidate when it is not already pinned and either `score > 0` or pinning it would shorten its optimal route by ≥ 2 presses. The suggestion card is **generated from this ranking**: it names the winning destination, cites the measured numbers (visits, total presses, excess presses, the discovery score, and the projected optimal drop computed by temporarily pinning it in the graph), and proposes the pin. In the standard demo flow the numbers naturally select Subtitles (1 visit, 8 presses, 2 excess); a user who repeatedly pays excess cost reaching a movie would be offered that movie's shortcut instead — the code path is identical. When the winning destination's statistics rest on exactly one measured run, the card appends an honesty note — "(Early suggestion from 1 run — it sharpens as you navigate more.)" — which disappears once the accumulated data covers two or more runs. Enlarged focus is listed as a **separate** proposed adaptation when reversal/backtrack counts are high, with its own toggle.

## Adaptation audit trail & undo
Every decision is appended to `state.adaptations` and rendered in the **Adaptations panel**:
- **Applied** entries (pin or enlarged focus) carry a timestamp, the evidence text from the suggestion that triggered them, and an **Undo** button.
- **Dismissed** suggestions are recorded as dismissed — the audit trail includes refusals, not just approvals.
- **Undo actually reverts**: for a pin, the Home tile is removed and the graph edge disappears (the graph is rebuilt from state on every query, so removal is immediate); for enlarged focus, the size mode and its Fitts effect revert. The revert is also written to the detection log.

## Cross-session persistence (`saveLearning` / `loadLearning` / `resetLearning`)
Learning that resets on reload is a demonstration, not learning — so the accumulated statistics persist in the browser's `localStorage` and genuinely accumulate over several sessions on the same device. Storage keys are prefixed `accessflow.`:

| Key | Contents |
| --- | --- |
| `accessflow.destStats` | per-destination `{visits, totalPresses, totalExcess, difficultyEvents}` |
| `accessflow.weights` | learned edge bumps (`state.weights`) |
| `accessflow.edgeOutcomes` | per-action-class `{traversals, errors}` behind the difficulty multiplier |
| `accessflow.prefixCounts` | learned path-prefix → destination counts |
| `accessflow.movementProfile` | the user's movement-profile preference |
| `accessflow.sessions` | session counter, incremented on every load |

On load, the engine restores these fields, increments and re-stores the counter, and everything downstream — discovery ranking, error rates, goal prediction, the metrics panel's "Session N" line — works from the accumulated totals. The suggestion card cites the scope honestly: with more than one session on the device its evidence line begins "Across N sessions on this device · …".

**What is deliberately NOT stored:** adaptations. A pinned shortcut is an in-the-moment approval, so pins (and enlarged-focus mode) are never silently restored — each session starts un-adapted and every adaptation is approved again. Transient run state (current task, timers, the results table, the audit panel) is likewise session-only.

**Failure behaviour:** storage is probed once and every access is wrapped in `try/catch`. If `localStorage` is unavailable or throws (some `file://` contexts, private mode, disabled storage), the app falls back to in-memory learning for the session with identical behaviour — nothing breaks, the data just doesn't carry over. **Reset learning** (Live metrics panel) removes the stored fields, clears the in-memory statistics, and returns the movement profile to Standard; the session counter restarts at 1. All data stays on-device in the browser — nothing is uploaded anywhere.

## Guided navigation (`guideRouteSteps` / `guideAdvance`, app-layer walkthrough)
Adapted from a teammate prototype's "Guided Navigation" pattern and rebuilt on the live graph: pressing **Guide me** in the Optimal path panel starts a walkthrough to the active task's destination. `guideRouteSteps(start, target)` converts the same unweighted Dijkstra route the panel displays into an ordered step list; the app appends one synthetic final step — the completing action performed *at* the destination node (its Select) — and renders destination, progress ("Step k of n", where consumed steps from superseded plans fold into the count so progress stays honest after a reroute), and the next action in words.

Step tracking is the pure `guideAdvance(plan, idx, currentKey)` classifier:
- **advance** — the user is on the expected step's target node (or jumped ahead to a later route node — progress fast-forwards);
- **stay** — still at the expected position (a blocked press or a self action such as toggling an unrelated setting);
- **reroute** — anywhere else: the route is recomputed from the user's actual node, the old plan's consumed steps fold into the progress base, and the update is written to the detection log ("Guided route updated from here").

The guide **observes presses only** — it never executes one (recovery's opt-in "take the next step for me" button remains a separate, explicit user action). Guided-mode presses flow through the same `press()` path as everything else, so deviations still register as reversals/backtracks/wrong selects. Lifetime is per-run by design: when the run completes, the guide shows "Destination reached" and ends; starting the next task clears it, and Guide me can be started again there (in Task 2 the guided route runs over the pinned shortcut — 2 steps).

## Live path-effort tally (`traversedCost` / `weightedRouteEffort`)
Adapted from the same prototype's "Estimated Navigation Effort" analytics. Press counts say *how many*; the tally says *how costly*, live. Each user press is priced by `traversedCost(from, to, kind, dir)` — the weighted cost of the single graph edge that press actually traversed, in the identical model as routing (Fitts + difficulty multiplier + learned bumps + movement profile); a press that traverses no edge (a blocked move) costs 0. The run accumulates these into `run.effort`, anchored at run start against `weightedRouteEffort(start, goal)`: the weighted Dijkstra cost over the same start → goal **including** the final action at the destination node (its Select edge), so the two figures are exactly comparable — following the optimal route makes them equal (verified in tests and in the headless drive: Task 2's adapted run tallies 3.3 vs optimal 3.3), and every detour, overshoot or reversal pushes the tally above optimal (the scripted Task 1 baseline tallies 18.2 vs 11.8). The tally resets per run with the other run metrics; presses the recovery feature performs on the user's behalf (`guided=true`) are excluded, matching their exclusion from the press count.

## Goal prediction for task recovery (`predictGoal`)
When difficulty spikes mid-task (≥ 3 backtracks or reversals, or a long idle with prior difficulty), the recovery card does not assume the task target — it **predicts** the destination:

```
raw(dest) = 0.5 × routeCoverage + 0.3 × historyPrior + 0.2 × learnedPrefix
```

- **routeCoverage** — LCS (longest common subsequence) length between the destination's *canonical route* (its Dijkstra path from Home) and the user's actual path so far, divided by the canonical route length. LCS is used instead of a strict prefix match so an early overshoot detour doesn't zero the evidence.
- **historyPrior** — the destination's share of all recorded visits.
- **learnedPrefix** — from `state.prefixCounts`: at each completed run, every prefix of the run's node sequence is counted toward the destination actually reached; the current path is looked up in that table.

Probabilities are the raw scores normalized. The recovery card shows the predicted goal, its probability, and its basis ("…% of Subtitles' usual route matches your path so far, plus your past visits"), and its button executes the next step on the Dijkstra path **to the predicted goal**.

**Honesty note:** this predictor is prefix/route statistics and counting over the graph. It is *algorithmic*, not learned by a neural model, and there is **no LLM anywhere in this system** — the UI and these docs say so explicitly. The only "learning" in AccessFlow is the measured statistics above (error rates, destination costs, prefix counts), all inspectable in the panels.

## Metrics
Each task run records presses, errors, backtracks, reversals, hesitations, and elapsed time, plus its destination and the optimal press count at run start. The results panel compares the baseline run against the adapted run using **only measured values from the actual runs** — no hard-coded results.

## Tests
`tests/engine.test.js` (Node's built-in `node:test`, no dependencies) evaluates the shipped `js/engine.js` unchanged in a `vm` context with a minimal DOM stub, and exercises the real production functions: `dijkstraCore` on a hand-built graph with a known shortest path, the live graph's known Home→Subtitles optimum, Fitts monotonicity and the enlarged-mode cost drop, the difficulty multiplier, `combineWeight`, `rankShortcutCandidates` on synthetic visit data (including the case where a movie beats Subtitles), `predictGoal`, `isReversal`, and the movement-profile multiplier (direction-only ×2.0, unweighted cost untouched, and profile-steered Dijkstra routing on a two-route graph), plus the cross-session persistence layer (serialize/parse round-trips against a storage stub, restore + session-counter increment across two engine loads sharing one stub, accumulated multi-session ranking, reset semantics, and throwing/absent-storage fallbacks), and the guided-navigation / path-effort layer (`guideRouteSteps` step generation on the live graph, `guideAdvance` position classification including jump-ahead and deviation, a deviation reroute walked end-to-end on a hand-built graph, and `traversedCost` accumulation along the optimal route equalling `weightedRouteEffort` while a detour exceeds it). The guide's DOM behaviour (rendering, deviation logging, destination-reached state) and the tally's live display are covered by a headless Puppeteer drive of the shipped page rather than unit tests, since they live in the DOM-coupled app layer. CI (`.github/workflows/ci.yml`) runs syntax checks plus `node --test` on every push.

## Scope / honesty note
This repository is a Fire TV *experience prototype*: a 10-foot UI simulator that runs the real engine end-to-end. The graph, Dijkstra optimizer, effort model, discovery, prediction, detection, and metrics are production-logic code; the roadmap item is packaging the same engine as a native Fire TV app with per-profile ability models.
