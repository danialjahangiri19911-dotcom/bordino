# Neobrutalism (brutal-a «پوستر قرمز») — integration notes

Source: `bordinodesign/Bordino-neobrutalism-Claude-Handoff (4)` (variant brutal-a, the handoff's
default) and `bordinodesign/Bordino-Chicken-Game-Design (2)` for «مرغ فراری».

## How it is built

- `src/bd/bd.css` is generated from the handoff's `reference/ui.css` by
  `tools/design/extract_css.py`: only rules that can apply to brutal-a, and `light-dark(a, b)` split into a light
  rule plus a twin under `:root[data-bd-scheme="dark"]` (light-dark() needs Chrome 123+).
- `src/bd/app.css`: the production frame (a page fills the viewport instead of the preview card),
  the brutal-a palette, and the few states the reference has no selector for.
- `src/bd/icons.ts`: the pinned Lucide 1.17.0 icons the app uses (`tools/design/gen_icons.mjs`; ISC licence in
  `public/bd/LUCIDE-LICENSE`).
- Illustrations: the handoff's transparent PNGs as WebP (400 and 840 px) in `public/bd/art`.
  Chicken artwork, sprite sheet and audio: `public/bd/chicken` (files unchanged).
- Appearance: light / dark / system in the existing `lt-theme-store`, applied before the first
  paint by `APPEARANCE_SCRIPT` (src/bd/appearance.ts).
- Type: Tahoma / Arial system stack as the design specifies (the old global Shabnam rule is gone).

## Route map (reference view → route → API)

| Reference | Route | Backend |
|---|---|---|
| landing | `/` | none (guest page) |
| login | `/pwa/register` | `POST registration/`, `POST resend_otp/` |
| otp | `/pwa/otp` | `POST login/` (4-digit code = server OTP_LENGTH), `GET customer/profile/me` |
| signup + onboarding (3 steps) | `/pwa/onboarding` | `POST customer/step/profile-setup/` or `PATCH …/me/` |
| home | `/pwa/main` | points summary, lottery list, profile (streak) |
| games | `/pwa/gameNet` | points summary |
| sudoku_levels + sudoku | `/pwa/sudoku` | existing engine (game charge, record-action) in the game shell |
| game2048 | `/pwa/2048` | existing engine in the game shell |
| crash | `/pwa/crash` | existing engine (`games/crash/*`) in the game shell |
| chicken | `/pwa/chicken` | `games/chicken/config, rounds, step, cashout` (the server decides every lane) |
| wheel | `/pwa/wheel` | `GET lotteries/lottery-wheel/:id/`, `POST …/spin/` (lands on the server's prize) |
| hafez | `/pwa/hafez` | `GET entertainment/fortune-reading/` |
| tarot | `/pwa/tarot` | `GET entertainment/tarot/?count=3 or 5` |
| wallet | `/pwa/wallet` | points + currency summary, points history |
| transactions | `/pwa/wallet/transactions` | points + currency history (paged) |
| tickets | `/pwa/wallet/tickets` → `/pwa/lottery/buy-ticket` | `PATCH lotteries/ticket/numbers/` (bound to lottery id + price) |
| withdraw | `/pwa/wallet/withdraw` | bank accounts, banks, `POST wallet/currency/withdraw/` (request_id) |
| lotteries | `/pwa/lottery` | lottery list, completed lotteries (paged) |
| lottery_detail | `/pwa/lottery/lottery-detail/:id` | detail, my tickets, results |
| — ticket | `/pwa/lottery/ticket-detail/:id` | ticket detail |
| — guide | `/pwa/lottery/guide` | lottery list (prize rules) |
| profile | `/pwa/profile` | profile, `PATCH customer/profile-image/me/`, logout |
| personal | `/pwa/profile/personal` | **new** `PATCH customer/profile/me/` (username, birthdate, gender) |
| security | `/pwa/profile/security` | logout |
| notifications | `/pwa/profile/notifications` | none (see gaps) |
| appearance | `/pwa/profile/appearance` | device setting |
| prizes | `/pwa/profile/prizes` | wallet histories (wheel_prize, lottery_prize rows) |
| achievements | `/pwa/profile/achievements` | profile (streak, referrals), points summary |
| rules | `/pwa/rules` | readable without an account |
| states | components: LoadState, EmptyState, Notice | — |

## Gaps (said in the UI, not faked)

- **Notifications**: the app sends no push or news SMS; the page says so and its switches are
  disabled.
- **Achievements**: no achievement definitions exist on the server; the page shows real numbers
  (streak, record, active tickets, referrals) and says badges are coming.
- **Session management**: only «this device» (logout ends its session on the server).
- **Official terms text**: not supplied; `/pwa/rules` describes how the app works and says the
  official text will be published there.
- **OTP length**: not exposed by the API; the page uses 4 (the server default, not overridden on
  prod).
- **Sudoku / 2048 / crash**: the previous engines are kept and run inside the design's game shell
  with the design font; their boards are not yet redrawn in the reference look.
- **Browser support**: the handoff uses `color-mix()` (Chrome 111+, Safari 16.2+); older browsers
  lose some tints, not content.
