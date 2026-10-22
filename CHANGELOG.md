# AccessFlow — Build Log (2026-10-22, hackathon day)
One day, six build stages. Every stage is a real commit on `main`; nothing is backdated.

## v6 — React Native platform scaffold imported (per team decision)
- The `android/`, `ios/` and `.bundle/` folders from Shivaprasad's React Native prototype were imported into this repo at his team's request, so the combined project carries both builds side by side: the shipped web engine + Fire TV wrapper (`fire-tv/`), and his RN platform scaffold. His RN app itself (package `com.accessflowapp`) remains canonical in his repo; the features adopted from it live in the web engine (see v3/v5).

## v5 — Combined build (guided navigation + effort tally)
- **Guided navigation walkthrough** — step-by-step route guidance ("Step k of n") that watches real presses and recomputes the route on deviation. *Adopted from Shivaprasad's prototype.*
- **Live path-effort tally** — "Your path effort: X · optimal Y" accumulates the weighted cost of your actual route against the computed optimum. *Adapted from Shivaprasad's navigation-effort analytics.*
- 20 automated tests, CI green.

## v4 — Learning that persists (+ honesty label)
- **Cross-session persistence** — run statistics, learned edge weights, error-rate learning and the movement profile accumulate on-device (localStorage) across sessions; the discovery card cites "Across N sessions · M measured runs". Approvals are never auto-restored; **Reset learning** control included.
- **Thin-data honesty** — a suggestion based on exactly 1 run labels itself "(Early suggestion from 1 run — it sharpens as you navigate more.)"
- 17 automated tests.

## v3 — Movement profiles (teammate adoption)
- **Directional movement profiles** — Standard / Reduce horizontal / Reduce vertical user preference scaling weighted route costs by direction (Home→Subtitles weighted effort 9.9 → 11.9 under Reduce-horizontal). *Adopted from Shivaprasad's "Reduced Horizontal Movement" profile.*
- 13 automated tests; README team credit added.

## v2 — Real intelligence
- **Automatic shortcut discovery** (frequency × excess cost, data-cited proposals), **Fitts's-law effort model** with per-user error learning, **adaptation audit + undo**, **goal-prediction recovery** (counting over the graph, labelled "not an LLM").
- **Fire TV app** — native Fire OS WebView wrapper (`fire-tv/`, package com.arya.accessflow) with prebuilt APK; install guide in `docs/INSTALL_FIRE_TV.md`.
- Node test suite + GitHub Actions CI; screenshots gallery.
- 11 automated tests.

## v1 — Core prototype
- Fire TV experience simulator with a real weighted navigation graph (38 nodes, 168 edges), live Dijkstra, difficulty detection (overshoots, reversals, backtracks, hesitations), approval-gated adaptation, measured before/after results (8 → 2 presses in the demonstration run).
