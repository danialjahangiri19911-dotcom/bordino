import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

/** Stake-like dark palette, scoped to the crash page. */
export const CRASH_COLORS = {
	page: "#0f212e",
	panel: "#1a2c38",
	raised: "#213743",
	border: "#2f4553",
	text: "#ffffff",
	muted: "#b1bad3",
	green: "#00e701",
	greenText: "#05121a",
	curve: "#f5b301",
	red: "#ed4163",
	pillLow: "#2f4553",
	pillHigh: "#00b85e",
};

/** Same curve as the server (apps/crash/services/fair.py): m(t) = e^(k·t). */
export function multiplierAt(elapsedMs: number, growthPerMs: number) {
	if (elapsedMs <= 0) return 1;
	return Math.floor((Math.exp(growthPerMs * elapsedMs) + 1e-9) * 100) / 100;
}

export function exactMultiplierAt(elapsedMs: number, growthPerMs: number) {
	return elapsedMs <= 0 ? 1 : Math.exp(growthPerMs * elapsedMs);
}

/** «۲.۴۱×», isolated left-to-right so the × stays after the number inside Persian sentences. */
export function formatMultiplier(value: number | string) {
	return `\u2066${toPersianDigits(Number(value).toFixed(2))}×\u2069`;
}

/** «۱٬۲۳۴» */
export function formatPoints(value: number) {
	return Math.floor(value).toLocaleString("fa-IR");
}

/**
 * Stake's "Profit on Win": what a win at `target` adds on top of the bet, never more than the
 * server's per-round payout cap allows (it cashes out at the cap on its own).
 */
export function profitOnWin(bet: number, target: number | null, maxPayout?: number) {
	if (!target || !Number.isFinite(target) || bet <= 0) return 0;
	// Like the server: the cap is a multiplier floored to 2 decimals, and the payout is
	// floor(bet × multiplier). Whole hundredths keep the float error out of the floor.
	let cents = Math.round(target * 100);
	if (maxPayout) cents = Math.min(cents, Math.floor((maxPayout * 100) / bet));
	return Math.floor((bet * cents) / 100) - bet;
}

/**
 * Recompute a revealed round in the browser, exactly like the server:
 * HMAC_SHA256(server_seed, `${client_seed}:${nonce}`) → first 4 bytes → crash point.
 * Needs crypto.subtle, so only on https (lottery.bordino.co), not the plain-IP address.
 */
export async function verifyCrashPoint(
	serverSeed: string,
	clientSeed: string,
	nonce: number,
	houseEdge: string,
	maxMultiplier: string,
): Promise<string | null> {
	if (typeof crypto === "undefined" || !crypto.subtle) return null;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(serverSeed),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const digest = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, encoder.encode(`${clientSeed}:${nonce}`)),
	);
	const x = BigInt(
		((digest[0] << 24) >>> 0) + (digest[1] << 16) + (digest[2] << 8) + digest[3],
	);
	const edgeBp = BigInt(Math.floor(Number(houseEdge) * 10000 + 1e-9));
	const TEN_THOUSAND = BigInt(10000);
	const cents =
		(BigInt("4294967296") * BigInt(100) * (TEN_THOUSAND - edgeBp)) /
		((x + BigInt(1)) * TEN_THOUSAND);
	const capped = Math.min(
		Math.max(100, Number(cents)),
		Math.round(Number(maxMultiplier) * 100),
	);
	return (capped / 100).toFixed(2);
}
