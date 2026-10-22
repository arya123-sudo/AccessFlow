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
weight = ( PRESS_BASE + fitts ) × difficultyMultiplier + learnedBump
fitts  = log2( distanceSteps / targetSize + 1 )        (Fitts's law, Shannon form)
```

- **distanceSteps** — grid distance in focus steps between the two tiles for move edges (Manhattan distance); `1` for Select/Back/Home, which act on the already-focused target.
- **targetSize** — a per-item size factor: movie/show posters `1.35`, pinned shortcut tiles `1.3`, full-width list rows `×1.15`, standard grid tiles `1.0`. **Enlarged-focus mode multiplies every size by 1.5**, which measurably lowers the Fitts component of every edge — this is computed, not cosmetic: the test suite asserts that a move edge costs less with enlarged mode on.
- **difficultyMultiplier** — `1 + this user's error rate` for that action class (`move:left`, `move:right`, `select`, …), where error rate = difficulty events ÷ traversals, both counted live (`noteTraversal` / `noteEdgeError` in `state.edgeOutcomes`). Capped at `1.9`.
- **learnedBump** — the original additive re-weighting: `+0.6` on the specific edge each time a difficulty event occurs on it (`state.weights`).

The metrics panel displays the model honestly, including the user's current measured error rate and the active target-size factor.

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

A destination becomes a candidate when it is not already pinned and either `score > 0` or pinning it would shorten its optimal route by ≥ 2 presses. The suggestion card is **generated from this ranking**: it names the winning destination, cites the measured numbers (visits, total presses, excess presses, the discovery score, and the projected optimal drop computed by temporarily pinning it in the graph), and proposes the pin. In the standard demo flow the numbers naturally select Subtitles (1 visit, 8 presses, 2 excess); a user who repeatedly pays excess cost reaching a movie would be offered that movie's shortcut instead — the code path is identical. Enlarged focus is listed as a **separate** proposed adaptation when reversal/backtrack counts are high, with its own toggle.

## Adaptation audit trail & undo
Every decision is appended to `state.adaptations` and rendered in the **Adaptations panel**:
- **Applied** entries (pin or enlarged focus) carry a timestamp, the evidence text from the suggestion that triggered them, and an **Undo** button.
- **Dismissed** suggestions are recorded as dismissed — the audit trail includes refusals, not just approvals.
- **Undo actually reverts**: for a pin, the Home tile is removed and the graph edge disappears (the graph is rebuilt from state on every query, so removal is immediate); for enlarged focus, the size mode and its Fitts effect revert. The revert is also written to the detection log.

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
`tests/engine.test.js` (Node's built-in `node:test`, no dependencies) evaluates the shipped `js/engine.js` unchanged in a `vm` context with a minimal DOM stub, and exercises the real production functions: `dijkstraCore` on a hand-built graph with a known shortest path, the live graph's known Home→Subtitles optimum, Fitts monotonicity and the enlarged-mode cost drop, the difficulty multiplier, `combineWeight`, `rankShortcutCandidates` on synthetic visit data (including the case where a movie beats Subtitles), `predictGoal`, and `isReversal`. CI (`.github/workflows/ci.yml`) runs syntax checks plus `node --test` on every push.

## Scope / honesty note
This repository is a Fire TV *experience prototype*: a 10-foot UI simulator that runs the real engine end-to-end. The graph, Dijkstra optimizer, effort model, discovery, prediction, detection, and metrics are production-logic code; the roadmap item is packaging the same engine as a native Fire TV app with per-profile ability models.
