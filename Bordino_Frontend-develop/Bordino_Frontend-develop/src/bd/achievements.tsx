/**
 * «دستاوردها»: badges earned from what the server already counts (activity streak record,
 * tickets ever held, invited friends, a profile photo). Nothing here is granted by
 * the browser; it only reads those numbers.
 */

import type { ReactNode } from "react";

export type BadgeId =
	| "streak3"
	| "streak7"
	| "streak30"
	| "ticket1"
	| "ticket10"
	| "ticket50"
	| "friend1"
	| "friend5"
	| "friend20"
	| "photo";

export interface BadgeFacts {
	/** Longest run of consecutive active days (profile.max_consecutive_days). */
	bestStreak: number;
	/** Every ticket the player has held, all lotteries (profile.tickets_total). */
	tickets: number;
	/** Players who joined with this player's code (profile.referral_count). */
	friends: number;
	hasPhoto: boolean;
}

interface Badge {
	id: BadgeId;
	title: string;
	/** What earns it, shown under the title. */
	goalText: string;
	goal: number;
	value: (f: BadgeFacts) => number;
}

export const BADGES: Badge[] = [
	{ id: "streak3", title: "شروع پرشور", goalText: "۳ روز پشت سر هم به بردینو سر بزن", goal: 3, value: (f) => f.bestStreak },
	{ id: "streak7", title: "یک هفتهٔ کامل", goalText: "۷ روز پشت سر هم همراه باش", goal: 7, value: (f) => f.bestStreak },
	{ id: "streak30", title: "همراه همیشگی", goalText: "۳۰ روز پشت سر هم همراه باش", goal: 30, value: (f) => f.bestStreak },
	{ id: "ticket1", title: "اولین بلیت", goalText: "اولین بلیت قرعه‌کشی‌ات را بگیر", goal: 1, value: (f) => f.tickets },
	{ id: "ticket10", title: "بلیت‌باز", goalText: "روی هم ۱۰ بلیت قرعه‌کشی بگیر", goal: 10, value: (f) => f.tickets },
	{ id: "ticket50", title: "شانس طلایی", goalText: "روی هم ۵۰ بلیت قرعه‌کشی بگیر", goal: 50, value: (f) => f.tickets },
	{ id: "friend1", title: "دعوت اول", goalText: "یک دوست با کد تو بیاید", goal: 1, value: (f) => f.friends },
	{ id: "friend5", title: "حلقهٔ دوستان", goalText: "۵ دوست با کد تو بیایند", goal: 5, value: (f) => f.friends },
	{ id: "friend20", title: "سفیر بردینو", goalText: "۲۰ دوست با کد تو بیایند", goal: 20, value: (f) => f.friends },
	{ id: "photo", title: "چهرهٔ آشنا", goalText: "عکس پروفایل بگذار", goal: 1, value: (f) => (f.hasPhoto ? 1 : 0) },
];

export interface BadgeState {
	badge: Badge;
	unlocked: boolean;
	/** min(value, goal): how far along, for the progress bar. */
	progress: number;
}

export function badgeStates(facts: BadgeFacts): BadgeState[] {
	return BADGES.map((badge) => {
		const value = Math.max(0, Math.floor(badge.value(facts) || 0));
		return { badge, unlocked: value >= badge.goal, progress: Math.min(value, badge.goal) };
	});
}

// ---------------------------------------------------------------------------------------------
// The art: one 96×96 medallion per badge in the app's neobrutal style (thick ink outline, hard
// offset shadow, flat brand colours). Inline SVG: no download, sharp at any size.

const INK = "#25252b";
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Medal({ tile, children, tier }: { tile: string; children: ReactNode; tier?: string }) {
	return (
		<>
			<circle cx="49" cy="50" r="38" fill={INK} />
			<circle cx="46" cy="47" r="38" fill={tile} {...S} />
			{children}
			{tier ? (
				<>
					<rect x="32" y="75" width="28" height="15" rx="7.5" fill={INK} />
					<text x="46" y="86.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="inherit">
						{tier}
					</text>
				</>
			) : null}
		</>
	);
}

const TICKET = "M24 36 h44 v8 a5 5 0 0 0 0 10 v8 h-44 v-8 a5 5 0 0 0 0 -10 Z";

const ART: Record<BadgeId, ReactNode> = {
	streak3: (
		<Medal tile="#ffe1c4" tier="۳">
			<path d="M46 20 C54 31 63 38 61 54 C60 65 53 71 46 71 C37 71 30 64 31 54 C32 45 38 41 39 32 C43 36 44 40 44 44 C48 38 48 29 46 20 Z" fill="#ff8a3d" {...S} />
			<path d="M46 49 C51 54 54 58 53 63 C52 67 49 69 46 69 C42 69 39 66 39 62 C39 57 43 55 46 49 Z" fill="#ffc94a" {...S} />
		</Medal>
	),
	streak7: (
		<Medal tile="#d6e8ff" tier="۷">
			<rect x="26" y="29" width="40" height="36" rx="4" fill="#fff" {...S} />
			<path d="M26 40 V33 a4 4 0 0 1 4 -4 h32 a4 4 0 0 1 4 4 v7 Z" fill="#df3f5c" {...S} />
			<path d="M36 24 v9 M56 24 v9" {...S} fill="none" />
			<path d="M36 53 l7 6 l13 -13" fill="none" stroke="#1f9d6b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
		</Medal>
	),
	streak30: (
		<Medal tile="#fff0b8" tier="۳۰">
			<path d="M24 63 L28 35 L38 48 L46 28 L54 48 L64 35 L68 63 Z" fill="#ffc94a" {...S} />
			<rect x="24" y="61" width="44" height="8" rx="2" fill="#ffb020" {...S} />
			<circle cx="46" cy="28" r="3.5" fill="#df3f5c" {...S} strokeWidth={2} />
			<circle cx="28" cy="35" r="3.5" fill="#7c5cff" {...S} strokeWidth={2} />
			<circle cx="64" cy="35" r="3.5" fill="#2bb6a3" {...S} strokeWidth={2} />
			<circle cx="46" cy="53" r="4.5" fill="#df3f5c" {...S} strokeWidth={2} />
		</Medal>
	),
	ticket1: (
		<Medal tile="#ffd9df" tier="۱">
			<path d={TICKET} fill="#df3f5c" {...S} />
			<path d="M37 39 v20" stroke="#fff8eb" strokeWidth="2.5" strokeDasharray="3 3" />
			<circle cx="53" cy="49" r="5" fill="#fff8eb" {...S} strokeWidth={2} />
		</Medal>
	),
	ticket10: (
		<Medal tile="#e6defd" tier="۱۰">
			<g transform="rotate(-14 46 49)">
				<path d={TICKET} fill="#7c5cff" {...S} />
			</g>
			<g transform="rotate(8 46 49) translate(2 4)">
				<path d={TICKET} fill="#df3f5c" {...S} />
				<path d="M37 39 v20" stroke="#fff8eb" strokeWidth="2.5" strokeDasharray="3 3" />
			</g>
		</Medal>
	),
	ticket50: (
		<Medal tile="#fff6d6" tier="۵۰">
			<path d={TICKET} fill="#ffc94a" {...S} />
			<path d="M50 39.5 l2.8 5.7 6.3 0.9 -4.6 4.4 1.1 6.3 -5.6 -3 -5.6 3 1.1 -6.3 -4.6 -4.4 6.3 -0.9 Z" fill="#fff" {...S} strokeWidth={2} />
			<path d="M20 30 l3 -3 M71 27 l3 3 M18 64 l4 1" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
		</Medal>
	),
	friend1: (
		<Medal tile="#cdf3ec" tier="۱">
			<rect x="25" y="38" width="42" height="28" rx="3" fill="#fff" {...S} />
			<path d="M25 40 L46 55 L67 40" fill="none" {...S} />
			<path d="M46 26 C42 19 32 21 33 28 C34 34 41 37 46 41 C51 37 58 34 59 28 C60 21 50 19 46 26 Z" fill="#df3f5c" {...S} />
		</Medal>
	),
	friend5: (
		<Medal tile="#ffe8d1" tier="۵">
			<circle cx="31" cy="40" r="6.5" fill="#7c5cff" {...S} />
			<path d="M19 64 C19 52 43 52 43 64 Z" fill="#7c5cff" {...S} />
			<circle cx="61" cy="40" r="6.5" fill="#2bb6a3" {...S} />
			<path d="M49 64 C49 52 73 52 73 64 Z" fill="#2bb6a3" {...S} />
			<circle cx="46" cy="44" r="8.5" fill="#ff8a3d" {...S} />
			<path d="M31 68 C31 54 61 54 61 68 Z" fill="#ff8a3d" {...S} />
		</Medal>
	),
	friend20: (
		<Medal tile="#ffd9df" tier="۲۰">
			<path d="M27 43 L53 31 V64 L27 52 Z" fill="#df3f5c" {...S} />
			<rect x="21" y="42" width="8" height="11" rx="2" fill="#fff8eb" {...S} />
			<path d="M33 54 l3 12 h7 l-2 -9" fill="#fff8eb" {...S} />
			<path d="M60 40 Q65 47.5 60 55 M65 34 Q73 47.5 65 61" fill="none" {...S} />
		</Medal>
	),
	photo: (
		<Medal tile="#e3f1ff">
			<rect x="27" y="25" width="38" height="44" rx="5" fill="#fff" {...S} />
			<circle cx="46" cy="42" r="8" fill="#ffd2b0" {...S} />
			<path d="M33 67 C33 54 59 54 59 67" fill="#7c5cff" {...S} />
			<circle cx="64" cy="65" r="9" fill="#df3f5c" {...S} />
			<circle cx="64" cy="65" r="3.2" fill="#fff" stroke={INK} strokeWidth={2} />
		</Medal>
	),
};

/** The badge's illustration; a locked one is greyed (CSS) under a padlock. */
export function BadgeArt({ id, locked }: { id: BadgeId; locked: boolean }) {
	return (
		<span className={`bd-badge-art${locked ? " is-locked" : ""}`} aria-hidden="true">
			<svg viewBox="0 0 96 96" width="72" height="72" focusable="false">
				{ART[id]}
			</svg>
			{locked ? (
				<svg className="bd-badge-lock" viewBox="0 0 24 24" width="24" height="24" focusable="false">
					<rect x="4" y="10" width="16" height="11" rx="2" fill="currentColor" />
					<path d="M8 10 V7 a4 4 0 0 1 8 0 v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
					<circle cx="12" cy="15.5" r="1.8" className="bd-badge-keyhole" />
				</svg>
			) : null}
		</span>
	);
}
