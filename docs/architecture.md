# Architecture Overview

## Game loop and rendering
The game is driven by `src/main.ts`, which boots an initial `GameState`, wires UI callbacks, and starts a `setInterval` loop that runs every 500 ms. Each tick skips updates while a modal event is open, the main menu is active, or the game is paused. Otherwise it advances the simulation via `updateGameTick(game)` and then refreshes visuals with `renderAll(game)`:

```
setInterval (500ms)
    ├─ guards: no popup, not main menu, not paused
    ├─ updateGameTick(game)
    │     ├─ advance ticks/days & quest timers
    │     ├─ apply training progress
    │     ├─ aggregate resource deltas from modules/people
    │     ├─ apply bounded resource changes & max caps
    │     ├─ sync population from people, spawn arrivals
    │     └─ trigger events that meet conditions
    └─ renderAll(game) // redraw UI
```

## Core game state
`GameState` (see `src/types.ts`) centralizes simulation data:
- **Resources** (`ResourcesState`): enabled flag, current value, optional max, and per-tick delta for each resource.
- **People** (`Person[]`): worker metadata, training progress, qualifications, and tick-based availability.
- **Qualifications**: available training options and their costs.
- **Grid & modules**: tile grid plus placed module states with coordinates, activity flag, worker slots, and qualification requirements/bonuses.
- **Events & quests**: pending event configs, triggered flags, active popup, and quest flag/timer values.
- **UI/session state**: selected building/module/person, current screen, pause flag, tick/day counters, and log messages.

## Module responsibilities
- **`src/core.ts`** initializes the starting station (resources, people, grid, starter habitat) and owns the per-tick update pipeline that advances time, processes training, aggregates resource deltas, enforces caps, derives population, spawns newcomers, and checks events.
- **`src/events.ts`** manages narrative popups: it evaluates configurable conditions against resources, timers, and flags, opens an `activeEventPopup` when met, and applies chosen option effects (resource changes, unlocks, quest flag/timer updates).
- **`src/buildings.ts`** governs grid management and construction. It generates module IDs, validates placement adjacency and affordability, applies build costs, rebuilds the grid, expands boundaries when needed, toggles modules on/off, and tracks worker assignments tied to module cells.
- **`src/resources.ts`** defines initial resources from configuration and provides helpers to accumulate per-tick deltas, apply bounded changes, validate affordability, and recompute resource maximums from module-provided bonuses.
- **`src/workforce.ts`** coordinates people and jobs: creating initial qualifications, validating worker requirements, assigning/removing workers, starting paid training (consuming resources), and probabilistically spawning new arrivals when dock capacity allows.

## Key data flows
- **Resource deltas**: `updateGameTick` builds a per-resource delta map from module production (including base, active workers, and bonus-qualified workers) plus personal incomes/needs. These deltas are applied with bounds and reflected in each resource's `deltaPerTick` field.
- **Population updates**: the population resource mirrors `people.length`, while `trySpawnNewPerson` adds new arrivals when dock modules exist and capacity allows, also updating log messages and dependent resource caps.
- **Event triggers**: `checkEvents` scans configured events each tick (when no popup is active) and opens the first one whose conditions match resource thresholds, elapsed time, or quest flags/timers; user choices then adjust resources, unlockables, and quest state via `applyEventOptionAndClose`.
