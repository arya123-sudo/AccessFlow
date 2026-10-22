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
Real captures from an actual run of the prototype (see `docs/DEMO_GUIDE.md` for the flow):

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

## Tests
```
node --test        # node:test suite in tests/ — Dijkstra, Fitts monotonicity,
                   # discovery ranking, goal prediction, detection helper
node --check js/engine.js && node --check js/app.js
```
CI (GitHub Actions, workflow `ci`) runs the same checks on every push.

## Demo
- **Live prototype:** https://arya123-sudo.github.io/AccessFlow/ — a mobile-first Fire TV experience simulator (10-foot UI + tappable on-screen remote).
- Task flow: Home → Settings → Accessibility → Subtitles → On, first unadapted, then adapted.
- Full walkthrough for judges: [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md)

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
.github/workflows/ci.yml  CI: syntax checks + node --test on push
docs/ARCHITECTURE.md  Engine, effort model, discovery, prediction, audit in detail
docs/DEMO_GUIDE.md    How to run the demo and what to try
```

## Tech
JavaScript, HTML/CSS, weighted graph + Dijkstra shortest path, real-time interaction analytics. Prototype experience for Fire TV.

## License
MIT
