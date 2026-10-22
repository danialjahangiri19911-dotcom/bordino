import type { ChickenDifficulty } from "@/api/games/chicken/types";

export const DIFFICULTY_LABELS: Record<ChickenDifficulty, string> = {
	easy: "آسان",
	medium: "متوسط",
	hard: "سخت",
};

export const ROAD_COLORS = {
	asphalt: "#2a3140",
	laneLine: "rgba(255,255,255,0.55)",
	sidewalk: "#3d4b5c",
	manhole: "#1c2330",
	manholeRing: "#4b5768",
	passed: "#f5b301",
	orange: "#ff9d00",
};

const CAR_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#e11d48"];

/** Stable per-lane look for the decorative traffic. */
export function laneTraffic(lane: number) {
	return {
		color: CAR_COLORS[(lane * 5) % CAR_COLORS.length],
		duration: 1.5 + ((lane * 37) % 17) / 10,
		delay: -((lane * 53) % 23) / 10,
	};
}

/**
 * Recompute where the car hits, exactly like the server (apps/crash/services/chicken.py):
 * lane i is hit when first4bytes(HMAC_SHA256(server_seed, `${client_seed}:${nonce}:${i}`)) / 2^32 < hit.
 * Returns 0 when no lane is hit, null without crypto.subtle (plain-http address).
 */
export async function verifyHitLane(
	serverSeed: string,
	clientSeed: string,
	nonce: number,
	lanes: number,
	hit: string,
): Promise<number | null> {
	if (typeof crypto === "undefined" || !crypto.subtle) return null;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(serverSeed),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const threshold = Number(hit) * 4294967296;
	for (let lane = 1; lane <= lanes; lane += 1) {
		const digest = new Uint8Array(
			await crypto.subtle.sign("HMAC", key, encoder.encode(`${clientSeed}:${nonce}:${lane}`)),
		);
		const x = ((digest[0] << 24) >>> 0) + (digest[1] << 16) + (digest[2] << 8) + digest[3];
		if (x < threshold) return lane;
	}
	return 0;
}
