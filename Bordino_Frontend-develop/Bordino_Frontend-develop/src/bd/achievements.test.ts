import { BADGES, badgeStates } from "./achievements";

const none = { bestStreak: 0, tickets: 0, friends: 0, hasPhoto: false };

describe("achievement badges", () => {
	it("every badge has its own id (one illustration each)", () => {
		expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
	});

	it("are all locked for a new player", () => {
		expect(badgeStates(none).every((s) => !s.unlocked && s.progress === 0)).toBe(true);
	});

	it("unlock exactly at their goal and cap the progress there", () => {
		const s = Object.fromEntries(badgeStates({ bestStreak: 9, tickets: 12, friends: 2, hasPhoto: true }).map((x) => [x.badge.id, x]));
		expect(s.streak3.unlocked && s.streak7.unlocked).toBe(true);
		expect(s.streak30.unlocked).toBe(false);
		expect(s.streak30.progress).toBe(9);
		expect(s.ticket10.unlocked).toBe(true);
		expect(s.ticket10.progress).toBe(10);
		expect(s.ticket50.progress).toBe(12);
		expect(s.friend1.unlocked && !s.friend5.unlocked).toBe(true);
		expect(s.photo.unlocked).toBe(true);
	});

	it("treat odd numbers from the server as zero", () => {
		const s = badgeStates({ bestStreak: Number("x"), tickets: -3, friends: 0, hasPhoto: false });
		expect(s.every((x) => x.progress >= 0 && !x.unlocked)).toBe(true);
	});
});
