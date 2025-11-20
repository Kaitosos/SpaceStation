# SpaceStation Config Editor (Dev Only)

This standalone editor is only intended for development. It reuses the game's existing `src/config.ts` and `src/types.ts` and does not ship in the production build.

## Build
1. Install dependencies once (if not already):
   ```bash
   npm install
   ```
2. Build the editor bundle (outputs to `devtools/config-editor/dist/`):
   ```bash
   npm run build:devtool
   ```

## Run locally
Open `devtools/config-editor/index.html` in your browser after building. The page loads `dist/configEditor.js` generated in the build step.

> Tip: If you prefer a local server, `npx http-server devtools/config-editor` (or any static server) works; the editor remains dev-only and separate from the production game build.
