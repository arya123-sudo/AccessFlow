AccessFlow

Ability-Aware Navigation for Smart TVs

Making TV navigation more accessible, adaptable, and measurable.

AccessFlow is an Android TV accessibility prototype developed using React Native for TV. It explores how navigation interfaces can respond to different movement preferences using weighted graph optimization.

The Problem

Traditional Smart TV interfaces often rely on extensive directional remote-control navigation.

Users who find repeated horizontal movements difficult may experience increased navigation effort when browsing large content catalogs.

Most conventional interfaces use the same navigation structure regardless of individual movement preferences.

Our Solution

AccessFlow explores ability-aware navigation through configurable user profiles, weighted route calculation, and navigation analytics.

The prototype demonstrates how an interface can estimate navigation effort and recommend alternative paths based on directional movement preferences.

Implemented Features

1. Android TV Movie Catalog

A TV-friendly interface containing selectable movie cards with remote-control focus navigation.

2. Navigation Preferences

Two configurable profiles:

* Standard: Equal directional movement costs.
* Reduced Horizontal Movement: Higher costs for left and right navigation.

3. Navigation Analytics

Tracks movement between movie cards, changes in horizontal navigation direction, and estimated navigation effort.

4. Graph-Based Route Optimization

Uses Dijkstra’s shortest-path algorithm to calculate a minimum-cost route through a demonstration navigation graph.

5. Guided Navigation

Provides a step-by-step route walkthrough with progress tracking.

Technology Stack

Component	Technology
Application	React Native for TV
Language	TypeScript
Platform	Android TV
Navigation optimization	Dijkstra’s algorithm
Development environment	VS Code
Testing	Android TV Emulator
Version control	Git and GitHub

How It Works

1. The user selects a navigation preference.
2. AccessFlow assigns directional movement costs based on that profile.
3. The navigation engine calculates a lowest-cost path.
4. The interface displays the recommended route.
5. Navigation analytics provide feedback on estimated movement effort.

Example

Standard Profile

Recommended route:

Home → Movies → Comedy

Estimated route effort: 2

Reduced Horizontal Movement Profile

Recommended route:

Home → Shortcuts → Comedy

Estimated route effort: 2

The route changes because horizontal navigation carries a higher cost under the second profile.

These are illustrative routes in the demonstration graph.

Project Structure

## Project Structure

```text
AccessFlowApp/
├── App.tsx
├── src/
│   └── navigation/
│       ├── navigationEngine.ts
│       └── sampleGraph.ts
├── android/
├── ios/
└── package.json
```

Running the Project

Prerequisites

* Node.js
* Java Development Kit 17
* Android SDK
* Android TV Emulator

Installation

Clone the repository and install dependencies:

git clone <https://github.com/shivaprasad938/accessflowai>
cd AccessFlow
npm install

Start Metro:

npm start

In a separate terminal, with an Android TV emulator running:

npx react-native run-android

Configure the Android SDK location before building.

Current Limitations

AccessFlow is an early-stage prototype.

* Route optimization currently operates on a sample navigation graph rather than the complete TV interface.
* Guided navigation demonstrates route progression but does not automatically move focus between controls.
* Navigation effort uses configurable heuristic weights rather than clinically validated accessibility measurements.
* The application does not control third-party streaming applications.
* User testing and formal accessibility evaluation remain future work.

Future Improvements

* Integrate weighted route optimization with actual TV focus navigation.
* Introduce adaptive shortcuts based on user-approved preferences.
* Add accessible content search.
* Conduct usability testing with real users.
* Compare task completion times and remote-control interactions across navigation modes.

Hackathon

Developed as a prototype for the Amazon Developer Hackathon 2026, Fire TV track.

Project Vision

AccessFlow aims to make digital entertainment easier to navigate by designing interfaces around users’ abilities rather than expecting every user to navigate in the same way.