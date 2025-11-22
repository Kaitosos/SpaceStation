# SpaceStation

SpaceStation is a TypeScript-driven colony management prototype where you construct a modular orbital base, balance vital resources, and guide a growing crew through events and training.

## Features
- **Modular station building:** Place generators, life support, habitats, and storage modules on a grid, activating or pausing modules as needed.
- **Resource simulation:** Track per-tick production and consumption for energy, oxygen, money, and population caps, including maximum capacity bonuses.
- **Crew management:** Generate and assign people to modules, respect qualification requirements, and progress training to unlock bonuses.
- **Dynamic events:** Encounter narrative events with conditional options that can modify resources, quests, and the station state.
- **Game loop & UI hooks:** A timed tick advances the simulation while rendering and event handling keep the interface responsive.

## Prerequisites
- Node.js (LTS recommended)
- npm (bundled with Node.js)
- TypeScript compiler (installed via dev dependencies)

## Installation
```bash
npm install
```

## Available npm scripts
- `npm run build` – compile the main TypeScript project with `tsconfig.json`.
- `npm run build:test` – compile test sources using `tsconfig.test.json`.
- `npm run build:devtool` – compile devtools using `tsconfig.devtool.json`.
- `npm test` – build test artifacts and execute the Node test runner against compiled specs.

## Quickstart
1. Install dependencies: `npm install`.
2. Build the project: `npm run build` (or run `npm run build:test` / `npm run build:devtool` for targeted outputs).
3. Run the automated tests (if desired): `npm test`.

The compiled JavaScript outputs are emitted to the `dist` directories defined by each TypeScript configuration.
