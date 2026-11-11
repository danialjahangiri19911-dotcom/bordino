# «جاسوس» — the design's game module (vendored)

`spy-engine.js`, `spy-ui.js`, `spy-ui.css` are copied from `Bordino-Spy-UI-Design` 1.0.6 (`assets/`),
unchanged except for two one-line patches (Codex review 2026-11-10; re-apply them after an update):
- `spy-ui.js` `opt()`: the option's `value` is escaped (`esc(v)`). An imported category name such as
  `"></select><img onerror=…>` broke out of the attribute and ran a script.
- `spy-engine.js` `Game.category()`: reads `SpyEngine.categories` (the server's topics) before its own
  bundled list, so a renamed or new topic shows its name in the private hint.
- `spy-engine.js` `Game.card()`: a spy's private card reads «شما جاسوس هستید» instead of «کلمه را
  نمی‌دانی» (Bordino's wording, 2026-11-11).

They are loaded in this order by `../SpyGame.tsx`.

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
