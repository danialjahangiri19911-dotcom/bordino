# «دُور» — the design's game module (vendored)

`decks.js`, `engine.js`, `dowr.js`, `dowr.css` are copied **unchanged** from
`Bordino-Dowr-Game-Design` v1.6 (`source/`). They are loaded in this order by `../DowrGame.tsx`.

The app around them (do not edit the vendored files; change the wrapper instead):
- cards and topics come from the server (`/api/v1/games/dowr/config/`) and replace the bundled deck
  in place before the game is mounted (`BordinoDowrDecks.cards / .categories`);
- the icons are drawn by `../lucide.ts` from the app's own Lucide 1.17.0 icon set (no 600 KB bundle);
- the app's style picks the design (brutal → `dr-brutal`, neon → `dr-neon`, neu → `dr-neu`) and
  `../dowr-app.css` adds the dark versions the design does not have (neobrutalism and neumorphism);
- a finished game (`onComplete`) is recorded at `/api/v1/games/dowr/games/` (no points move).

To update: copy the new `source/*` files here, then run the app's Dowr browser test in all styles.
