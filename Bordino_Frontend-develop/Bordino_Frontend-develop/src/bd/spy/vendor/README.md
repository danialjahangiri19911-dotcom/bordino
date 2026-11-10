# «جاسوس» — the design's game module (vendored)

`spy-engine.js`, `spy-ui.js`, `spy-ui.css` are copied **unchanged** from `Bordino-Spy-UI-Design` 1.0.6
(`assets/`). They are loaded in this order by `../SpyGame.tsx`.

The app around them (do not edit the vendored files; change the wrapper instead):
- topics and words come from the server (`/api/v1/games/spy/config/`) and replace the sample bank
  (`SpyEngine.categories / .words`) before the game is mounted; topic names are escaped there (the
  module writes them into its markup as they are);
- the icons are drawn by `../../dowr/lucide.ts` from the app's own Lucide 1.17.0 icon set;
- the app's style is the look (brutal → `sp-brutal`, neon → `sp-neon`, neu → `sp-neu`; the module's own
  theme setting is hidden) and `../spy-app.css` adds the dark neobrutalism and neumorphism;
- players' own words, preferences and results stay on the device (localStorage `bordino-spy-v1`);
  purchases and premium packs stay disabled, as in the design.

To update: copy the new `assets/*` files here (not `lucide.js`), then run the app's Spy browser test in
all styles.
