# AccessFlow — Build Log (2026-10-22, hackathon day)
One day, ten build stages. Every stage is a real commit on `main`; nothing is backdated.

## v10 — Home rebuilt as the reference launcher; page is a product, not a pitch
- Home now mirrors the Android TV launcher structure from the team's reference video: tabs bar (Search · Home · Shop · Discover · Apps, gear, avatar, live clock) floating over a full-bleed hero, "Favorite Apps" row (the existing focusable tiles), chips row, a wide "Curated by AccessFlow" feature panel, and landscape (16:9) poster rows — "Top selling movies" and "Recently Added".
- The Problem/Solution cards were removed from the demo page itself (they remain in this repo's README and the Devpost text, where judges read them); the presenter script was updated to match.
- Presentational only, as ever: graph 44 nodes / 206 edges, canonical flow re-verified (8 → 2 presses, 20/20 tests).

## v9 — Google TV-style rich layer (from the reference video, ~2:55)
- Home hero is now full-bleed: edge-to-edge backdrop art filling the top half of the TV, slim "For You · Movies · Shows · Apps" strip, FEATURED title treatment with match-% meta chips and synopsis over the art.
- Portrait (2:3) poster rows in the Google TV style — "Top Selling Movies" and "Recently Added" — mixing our catalog with Shivaprasad's titles (decoration only, non-focusable).
- Movie detail page rebuilt to the reference: full-bleed backdrop, meta in the "2h 10m • 2024 • Adventure • U/A 13+ • 4K" format with a deterministic match %, original one-line synopses for all 15 titles, white Play pill + Watchlist, Cast row (5 sample avatars), "More Like This" posters.
- Still purely presentational: graph unchanged (44 nodes / 206 edges), canonical flow re-verified (8 → 2 presses; 20/20 tests; 27/27 headless checks).

## v8 — Streaming-UI restyle (his look, our engine)
- The TV UI was re-themed to Shivaprasad's design language: deep navy `#0B1020`, teal `#55D6BE` accent, ACCESSFLOW wordmark + "Ability-Aware Smart TV Navigation" tagline, cinematic Home hero (featured title), poster-card rows, teal focus borders with scale — the Netflix/Hotstar-style presentation of his RN prototype.
- Purely presentational: no item id, coordinate, order or action changed; graph still 44 nodes / 206 edges; canonical flow re-verified (8 presses → 2; 20/20 tests). All gallery screenshots re-shot in the new look.

## v7 — Full prototype consolidation (per team decision)
- Shivaprasad's complete React Native project imported: root project files (`App.tsx`, `index.js`, `src/navigation/`, `__tests__/`, package + Metro/Babel/Jest/TS configs, Gemfile) — his repo is now present in full (57/57 files, hashes verified); his README is preserved as `RN_PROTOTYPE_README.md`.
- His six-title movie catalog (The Last Horizon, City of Dreams, Beyond the Stars, Laugh Out Loud, Hidden Truth, Family Time — with his genre/duration metadata) now appears as real, focusable tiles in the shipped demo's Movies screen, with an on-screen credit line. Graph grew 38 → 44 nodes, 168 → 206 edges; canonical demo flow re-verified unchanged (Task 1: 8 presses → Task 2: 2 presses; 20/20 tests).

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

## v11 — Black / red / yellow identity (final design direction)
- The blue identity is gone: black base (#050505/#0b0b0f), red (#e50914) for primary actions/active states, yellow (#ffc61a) for the focus ring, key figures and badges.
- Composition unchanged from v10: Home + Search live at the top; Subtitles and all content below; tiles are black with red/yellow accents; hero and poster art shifted to ember/gold/charcoal.
- Colours, gradients, borders and shadows only — no layout, logic or data changes. Graph still 44 nodes / 206 edges; canonical flow re-verified (Task 1 = 8 presses → Task 2 = 2). All gallery screenshots re-shot.

## v12 — Netflix-style identity + real photographic posters
- TV surface now reads as a streaming service: full ACCESSFLOW wordmark in Netflix red, photographic hero with Play / More Info pills, green match %, yellow kept only for the focus ring (visibility is the accessibility point).
- All 15 movie posters are real themed photographs (Pexels, free license) shipped in the repo under assets/posters/ with a CREDITS.md — hero, rows, catalog and detail pages all use the photographic key art; the gradient-block posters are gone.
- Presentation only, as before: graph 44 nodes / 206 edges, canonical flow re-verified (8 → 2 presses), 20/20 tests.

## Post-v12 — pinned shortcut moves below Favorite Apps
- The pinned Subtitles shortcut no longer takes the top of Home: it renders in its own "Your shortcut" row UNDER the Favorite Apps grid (Search / Movies / TV Shows / Apps / Settings keep their original positions, pinned or not — the baseline route through Home is byte-identical).
- Focus behaviour unchanged: Home still opens on the approved shortcut, so the adapted run stays exactly 2 presses (OK opens Subtitles, OK turns it on) and discovery still reads "optimal drops from 6 presses to 2". Graph at load unchanged: 44 nodes / 206 edges; 20/20 tests; canonical flow re-verified headlessly (Task 1 = 8 presses / 1 reversal → Task 2 = 2 presses / 0 reversals).

## v13 — Page stripped to the working model; Subtitles shortcut moved down
- The demo page is now only the product: wordmark, TV, remote, live metrics, optimal path/Guide me, session log, results, adaptations. Removed: task cards, the demo-video recording script, the "How AccessFlow works" explainer, footer essay, taglines and all procedure microcopy (in-TV toasts now speak like a real TV).
- The pinned Subtitles shortcut now renders in its own "Your shortcut" row BELOW the Favorite Apps row (Search/Movies stay up top); Favorite Apps tile positions never shift when a pin appears. Adapted run verified still exactly 2 presses; results still 8 → 2 presses, 1 → 0 reversals; graph 44 nodes / 206 edges.

## v14 — Demo video v4
- New demo video filmed entirely on the v13 build (Netflix-style UI, photographic posters, clean working-model page, Subtitles shortcut in its row below the apps): https://youtu.be/CSZ3Wbp67YM (2:52). Supersedes v3, which showed the pre-v13 page.
