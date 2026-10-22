# AccessFlow — Architecture

## Overview
AccessFlow is an AI-assisted, self-adaptive navigation layer for Fire TV. Instead of a fixed menu tree, navigation is modelled as a **weighted graph** and continuously re-optimized around the individual user's measured difficulty. The system follows a strict loop:

**Detect → Optimize → Suggest → Approve → Adapt**

No adaptation is ever applied without the user's explicit approval.

## The navigation graph (`js/engine.js`)
- **Node** = a `(screen, focused item)` pair — e.g. `(settings, accessibility)`, `(accessibility, subtitles)`.
- **Edge** = one remote action: a D-pad move, **Select**, **Back**, or **Home**.
- **Base weight** = 1 per press. Edges where the user repeatedly struggles gain weight from observed events (below), so the "cost" of a route reflects this user's real effort, not an average user's.
- **Shortest path** = Dijkstra's algorithm over the current weighted graph, computed live. The demo shows the optimal press count and route for the active task at all times (the built demo measured 38 nodes / 168 edges).

## Difficulty detection (`js/app.js`)
Every press is logged with a timestamp and classified:
- **Overshoot / reversal** — moving past the target item and immediately reversing direction.
- **Backtrack** — using Back shortly after entering a screen (wrong branch taken).
- **Wrong select** — selecting an item that cannot lead to the current goal.
- **Hesitation** — long pauses between presses on a route the user repeats.

When difficulty events cross a threshold, the engine raises the weights of the traversed edges and an adaptation is *proposed* (not applied).

## Adaptations (approval-gated)
Proposed adaptations are shown with the evidence that triggered them ("3 overshoots on the way to Subtitles; 8 presses vs 6 optimal"). Current adaptations:
- **Pin a shortcut** — adds a low-weight edge: a Home tile that jumps straight to the goal (Task 2 in the demo drops from 8 presses to 2).
- **Enlarged focus mode** — larger focus targets and focus ring for users who overshoot.

Dismissing a suggestion changes nothing; the graph keeps learning either way.

## Contextual task recovery
If backtracks/reversals spike mid-task, AccessFlow infers the likely goal and offers the next step on the current optimal path as a recovery action.

## Metrics
Each task run records presses, errors (overshoots + wrong selects), backtracks, reversals, and elapsed time. The results panel compares the baseline run against the adapted run using **only measured values from the actual runs** — no hard-coded results.

## Scope / honesty note
This repository is a Fire TV *experience prototype*: a 10-foot UI simulator that runs the real engine end-to-end. The graph, Dijkstra optimizer, detection, and metrics are production-logic code; the roadmap item is packaging the same engine as a native Fire TV app with per-profile ability models.
