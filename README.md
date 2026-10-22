# AccessFlow: AI-Powered Adaptive Navigation for Smart TV Accessibility

[![ci](https://github.com/arya123-sudo/AccessFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/arya123-sudo/AccessFlow/actions/workflows/ci.yml)

An AI-assisted, self-adaptive navigation system for Amazon Fire TV that personalizes navigation based on individual user needs and interaction patterns — built for the **Build, Ship, Shape: Amazon Developer Hackathon** (Fire TV track).

## The problem
Smart TV applications require complex menu navigation and repeated remote-control interactions, creating accessibility challenges for users with motor impairments and navigation difficulties. Existing interfaces do not adapt to individual interaction patterns, resulting in increased effort, navigation errors, and difficulty completing tasks.

## The solution
AccessFlow identifies navigation difficulties, dynamically optimizes interaction paths using **weighted graph algorithms**, and provides **contextual task recovery**. It continuously adapts to **user-approved** preferences to reduce navigation effort, minimize errors, and make the smart TV experience more intuitive and personalized.

## Key innovation
A self-adapting, ability-aware navigation engine that learns from interaction difficulties and optimizes TV navigation workflows, instead of relying on fixed navigation structures.

## Screenshots
Real captures from actual runs of the prototype (see `docs/DEMO_GUIDE.md` for the flow; build history in `CHANGELOG.md`):

**Guided navigation — step-by-step walkthrough that reroutes when you deviate**
![Guided navigation](screenshots/guided-navigation.png)

**Live metrics — movement profiles, your path effort vs the optimal, learning status**
![Metrics, tally and profiles](screenshots/metrics-tally-profiles.png)

**Discovery across sessions — the suggestion cites accumulated data (2 sessions, 2 runs, 16 presses)**
![Discovery across sessions](screenshots/discovery-across-sessions.png)

**Results + Adaptations audit panel — every applied change, its evidence, and Undo**
![Adaptations panel](screenshots/adaptations-panel.png)

**Fire TV Home — baseline navigation**
![Home](screenshots/home.png)

**Task 1 done — difficulty detected and logged live (overshoots, reversals, presses vs optimal)**
![Detection log](screenshots/detection-log.png)

**AccessFlow proposes an adaptation — with its evidence, and only the user can approve it**
![Adaptation suggestion](screenshots/adaptation-suggestion.png)

**Home after approval — the Subtitles shortcut is pinned**
![Home adapted](screenshots/home-adapted.png)

**Measured results — baseline vs adapted run, computed from the actual runs**
![Results](screenshots/results.png)

## How it works
1. **Detect** — every remote press is logged; overshoots, backtracks, wrong selects, reversals, and hesitations are classified live.
2. **Optimize** — screens and focus positions are graph nodes, remote actions are weighted edges; Dijkstra's algorithm computes the lowest-effort path to the goal. Edge costs use a Fitts's-law effort model — `(1 + log₂(distance ÷ target size + 1)) × (1 + your error rate)` plus a learned bump on edges where you struggled — so "effort" reflects target size, distance, and your own error pattern, not just press counts.
3. **Discover & suggest** — after each run, destinations are ranked by `visits × average excess cost` from your measured statistics, and a shortcut to the *winning* destination is proposed with its evidence. Nothing is pre-chosen: costly, frequent destinations surface on their own. Enlarged focus is proposed separately when overshoots/reversals are high.
4. **Approve** — nothing changes without the user's explicit approval.
5. **Adapt, audit & undo** — applied adaptations are recorded in an audit panel with their triggering evidence and a timestamp, and each can be **undone** (the shortcut tile, graph edge, and size mode all revert). Dismissed suggestions are recorded too.
6. **Recover** — mid-task difficulty triggers a recovery card whose goal is *predicted* from your path so far (route-coverage matching against each destination's canonical route, blended with learned prefix counts and visit history) with the next Dijkstra step to that goal. This is transparent counting over the graph — **not an LLM**, and it is labelled that way in the UI.
7. **Movement profile** — a preference *you* set (Standard / **Reduce horizontal effort** / **Reduce vertical effort**), never an auto-adaptation: moves in the direction you find harder cost ×2.0 in the weighted effort model, so effort-based routing (the weighted-effort figure, the recovery card's next step) steers around that axis. Press counts and optimal-press figures never change — only weighted cost does. Set it any time from the Live metrics panel; changes are logged as preferences, not adaptations.
8. **Learning persists on-device** — the accumulated statistics behind discovery (per-destination visits/presses/excess, learned edge weights, error rates, prefix counts), your movement profile, and a session counter are kept in this browser's local storage and **accumulate across sessions**, so suggestions cite your real history ("Across 3 sessions · 4 measured runs…"). Data never leaves the device. Adaptations (pinned shortcuts) are *not* stored — each is approved per session. **Reset learning** in the Live metrics panel wipes the stored data and returns the profile to Standard.
9. **Guide me (guided navigation)** — press **Guide me** in the Optimal path panel and AccessFlow walks you to the active task's destination one step at a time: the destination, your progress ("Step k of n"), and the next action in words ("Press ▼ (Down) to “Settings”", "Press OK to open Accessibility"), all derived live from the same Dijkstra route the panel displays. It advances when *you* perform the expected action — it never presses anything for you — and if you wander off the route it recomputes from where you actually are and logs the update. Deviations still count as difficulty signals, exactly as unguided.
10. **Live path-effort tally** — the metrics panel prices your run as it happens: **"Your path effort: X · optimal Y"**, where X sums the weighted costs (Fitts + your error rate + learned bumps + movement profile) of the edges you *actually* traversed this run, and Y is the weighted cost of the cheapest route over the same start → goal, including the final action at the destination. Take the optimal route and X = Y; every detour pushes X above it — effort, not just press counts, is now visible live.

### Architecture at a glance
```mermaid
flowchart LR
    A[Remote key events] --> B[Event log & difficulty detection]
    B --> C[Weighted navigation graph<br/>Dijkstra + Fitts effort model]
    C --> D[Shortcut discovery<br/>visits x excess cost]
    C --> E[Goal prediction<br/>route coverage + history]
    E --> F[Contextual recovery card]
    D --> G{User approves?}
    G -- yes --> H[Adaptation applied<br/>pinned shortcut / enlarged focus]
    G -- no --> I[Dismissal recorded]
    H --> J[Audit panel<br/>evidence + Undo]
    B --> K[Measured results<br/>before vs after]
```

## Tests
```
node --test        # node:test suite in tests/ — Dijkstra, Fitts monotonicity,
                   # discovery ranking, goal prediction, detection helper,
                   # cross-session persistence round-trips, guided-route
                   # step tracking, path-effort accumulation
node --check js/engine.js && node --check js/app.js
```
CI (GitHub Actions, workflow `ci`) runs the same checks on every push.

## Demo
- **Demo video (final, 2:50):** https://youtu.be/J_oQSTQ5kQE — detection, movement profiles, live effort tally, recovery prediction, shortcut discovery, cross-session learning, guided navigation, audit & undo, and the measured 8 → 2 press improvement.
- **Live prototype:** https://arya123-sudo.github.io/AccessFlow/ — a mobile-first Fire TV experience simulator (10-foot UI + tappable on-screen remote).
- Task flow: Home → Settings → Accessibility → Subtitles → On, first unadapted, then adapted.
- Full walkthrough for judges: [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md)

## Fire TV app
The same engine ships as a native Fire OS app — a thin WebView shell (package `com.arya.accessflow`) bundling this exact web build, driven by real Fire TV remote key events. Source: [`fire-tv/`](fire-tv/) · Build & sideload guide: [docs/INSTALL_FIRE_TV.md](docs/INSTALL_FIRE_TV.md) (includes honest status notes on device-farm verification).

## User study
A structured study protocol (3 tasks, no staged errors, standard SUS questionnaire, non-dominant-hand runs labelled as simulation) lives in [`docs/study/`](docs/study/). Participants run the live demo; the app's own panels report presses/errors/time. Results are compiled in `docs/study/results.csv` and summarised in the Devpost description as they complete.

## Run locally
No build step and no dependencies — serve the folder with any static server:
```
npx serve .
# or
python3 -m http.server
```
Then open `index.html` in a browser. Controls: on-screen remote, or arrow keys + Enter + Backspace.

## Project structure
```
index.html          Page shell and TV/remote markup
css/styles.css      10-foot UI theme, focus states, responsive layout
js/engine.js        Weighted navigation graph, Dijkstra optimizer, Fitts effort
                    model, shortcut discovery, goal prediction, adaptive UI state
js/app.js           Event logging, difficulty detection, metrics, task flow,
                    adaptation audit trail & undo
tests/engine.test.js  Node test suite for the engine's pure logic
fire-tv/              Native Fire OS wrapper app (WebView shell, Gradle project)
docs/INSTALL_FIRE_TV.md  Build & sideload guide for the Fire TV app
docs/study/           User-study protocol, participant script, results
.github/workflows/ci.yml  CI: syntax checks + node --test on push
docs/ARCHITECTURE.md  Engine, effort model, discovery, prediction, audit in detail
docs/DEMO_GUIDE.md    How to run the demo and what to try
```

## Tech
JavaScript, HTML/CSS, weighted graph + Dijkstra shortest path, real-time interaction analytics. Prototype experience for Fire TV.

## Team & related work
- **Arya Yaligar** — main build: engine, demo, Fire TV app, tests, video, submission.
- **Shivaprasad** ([@shivaprasad938](https://github.com/shivaprasad938)) — parallel React Native exploration of the same idea: [accessflowai](https://github.com/shivaprasad938/accessflowai). Its directional movement-cost profiles (e.g. "Reduced Horizontal Movement") inspired the **Movement profile** preference adopted into this build's effort model, and its guided route walkthrough ("Guided Navigation") and estimated-effort analytics inspired the **Guide me** walkthrough and the **live path-effort tally** adopted here.

## License
MIT
