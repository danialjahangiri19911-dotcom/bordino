/**
 * Parts of the app switched off for now, kept whole for later (2026-11-11).
 *
 * CASH_WALLET_VISIBLE: the cash (toman) wallet is hidden from players: its card on the wallet page
 * and the «نقدی» filter of the transactions. Its code, the withdraw page (/pwa/wallet/withdraw), the
 * server's accounts and the admin's withdrawals all stay as they are: set this to true to show it again.
 */
export const CASH_WALLET_VISIBLE = false;

/** The unit of a lottery or wheel prize: while the cash wallet is hidden, prizes are paid in coins
 * (1 coin = 1 toman, the server's CASH_PRIZES_AS_COINS), so the same number reads «سکه». */
export const PRIZE_UNIT = CASH_WALLET_VISIBLE ? "تومان" : "سکه";
