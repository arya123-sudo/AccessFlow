# AccessFlow: AI-Powered Adaptive Navigation for Smart TV Accessibility

An AI-assisted, self-adaptive navigation system for Amazon Fire TV that personalizes navigation based on individual user needs and interaction patterns — built for the **Build, Ship, Shape: Amazon Developer Hackathon** (Fire TV track).

## The problem
Smart TV applications require complex menu navigation and repeated remote-control interactions, creating accessibility challenges for users with motor impairments and navigation difficulties. Existing interfaces do not adapt to individual interaction patterns, resulting in increased effort, navigation errors, and difficulty completing tasks.

## The solution
AccessFlow identifies navigation difficulties, dynamically optimizes interaction paths using **weighted graph algorithms**, and provides **contextual task recovery**. It continuously adapts to **user-approved** preferences to reduce navigation effort, minimize errors, and make the smart TV experience more intuitive and personalized.

## Key innovation
A self-adapting, ability-aware navigation engine that learns from interaction difficulties and optimizes TV navigation workflows, instead of relying on fixed navigation structures.

## How it works
1. **Detect** — every remote press is logged; overshoots, backtracks, wrong selects, reversals, and hesitations are classified live.
2. **Optimize** — screens and focus positions are graph nodes, remote actions are weighted edges; Dijkstra's algorithm computes the lowest-effort path to the goal. Edge weights rise where this user struggles.
3. **Suggest** — when difficulty crosses a threshold, an adaptation is proposed with its reason (e.g., pin a Subtitles shortcut on Home, larger focus targets).
4. **Approve** — nothing changes without the user's explicit approval.
5. **Adapt & measure** — the same task is re-run and the before/after presses, errors, and time are compared from measured data.

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
js/engine.js        Weighted navigation graph, Dijkstra optimizer, adaptive UI state
js/app.js           Event logging, difficulty detection, metrics, task flow
docs/ARCHITECTURE.md  Engine, detection signals, and adaptation policy in detail
docs/DEMO_GUIDE.md    How to run the demo and what to try
```

## Tech
JavaScript, HTML/CSS, weighted graph + Dijkstra shortest path, real-time interaction analytics. Prototype experience for Fire TV.

## License
MIT
