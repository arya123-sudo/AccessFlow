# AccessFlow — Demo Guide

## Run it
- **Live:** open the GitHub Pages site for this repo (link in the README / Devpost submission).
- **Locally:** serve the folder with any static server, e.g. `npx serve .` or `python3 -m http.server`, then open `index.html`. No build step, no dependencies.

## Controls
- **On-screen remote** (mobile-friendly): D-pad, OK/Select, Back, Home.
- **Keyboard:** arrow keys to move, Enter to select, Backspace/Esc for Back.

## The demo flow (what judges should try)
1. **Task 1 — Turn on Subtitles (baseline).** Navigate Home → Settings → Accessibility → Subtitles → On using the remote. Navigate naturally; the metrics panel counts every press and the event log flags overshoots, backtracks, and wrong selects as they happen. The optimal-path indicator shows what Dijkstra computes as the cheapest route.
2. **The suggestion (discovered, not scripted).** After the run, AccessFlow ranks destinations by `visits × average excess cost` from your measured runs and proposes a shortcut to the winner — in this flow, Subtitles — citing its own data (total presses, excess vs the Dijkstra optimal, discovery score), plus enlarged focus when overshoots/reversals are high. Nothing changes until you tap **Approve & apply** — try **Dismiss** first if you want to prove that (dismissals are recorded in the audit panel).
3. **Task 2 — Same task, adapted.** Use the new Home shortcut. The results panel then renders the measured before/after comparison (presses, errors, time, % improvement) from your two actual runs.
4. **Task 3 (bonus) — Play "River Run".** Shows the engine generalizing to a content task. Get "lost" on purpose (several Back presses) to trigger **contextual recovery**: the card predicts your goal from your path so far and past visits — labelled in-app as counting over the graph, not an LLM — and offers the next step on the shortest route.
5. **Adaptations panel.** Lists every applied adaptation with its timestamp and triggering evidence. Use **Undo** to revert one: the Home shortcut tile and its graph edge are removed and the revert is logged.

## Project layout
```
index.html          Page shell and TV/remote markup
css/styles.css      10-foot UI theme, focus states, responsive layout
js/engine.js        Weighted navigation graph, Dijkstra, adaptive UI state
js/app.js           Event logging, difficulty detection, metrics, task flow,
                    adaptation audit trail & undo
tests/              Node engine tests (node --test); CI in .github/workflows
fire-tv/            Native Fire OS wrapper app (see docs/INSTALL_FIRE_TV.md)
docs/               Architecture, install guide, study protocol, this guide
```
