# AccessFlow — Demo Guide

## Run it
- **Live:** open the GitHub Pages site for this repo (link in the README / Devpost submission).
- **Locally:** serve the folder with any static server, e.g. `npx serve .` or `python3 -m http.server`, then open `index.html`. No build step, no dependencies.

## Controls
- **On-screen remote** (mobile-friendly): D-pad, OK/Select, Back, Home.
- **Keyboard:** arrow keys to move, Enter to select, Backspace/Esc for Back.

## The demo flow (what judges should try)
1. **Task 1 — Turn on Subtitles (baseline).** Navigate Home → Settings → Accessibility → Subtitles → On using the remote. Navigate naturally; the metrics panel counts every press and the event log flags overshoots, backtracks, and wrong selects as they happen. The optimal-path indicator shows what Dijkstra computes as the cheapest route.
2. **The suggestion.** After the run, AccessFlow presents what it detected (with numbers) and proposes pinning a Subtitles shortcut on Home plus enlarged focus. Nothing changes until you tap **Approve & apply** — try **Dismiss** first if you want to prove that.
3. **Task 2 — Same task, adapted.** Use the new Home shortcut. The results panel then renders the measured before/after comparison (presses, errors, time, % improvement) from your two actual runs.
4. **Task 3 (bonus) — Play "River Run".** Shows the engine generalizing to a content task, plus contextual recovery if you get lost on the way.

## Project layout
```
index.html          Page shell and TV/remote markup
css/styles.css      10-foot UI theme, focus states, responsive layout
js/engine.js        Weighted navigation graph, Dijkstra, adaptive UI state
js/app.js           Event logging, difficulty detection, metrics, task flow
docs/               Architecture and this guide
```
