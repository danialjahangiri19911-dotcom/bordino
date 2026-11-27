/** The Dowr engine's handoff (2026-11-27 playtest): the next card stays hidden until its player says
 * they hold the phone, unless the group chose an immediate or timed handoff. */
import "./vendor/engine.js";

type Engine = {
	phase: string;
	player: string;
	team: number;
	seat: number;
	scores: number[];
	current: { text: string } | null;
	handoffMs: number;
	bombRuns: boolean;
	ready(now: number): boolean;
	tick(now: number): void;
	act(kind: string, now: number): boolean;
	expire(now: number): void;
	continueAfterTimeout(now: number): boolean;
};
const Game = (globalThis as unknown as { BordinoDowrEngine: new (config: object, cards: object[], random?: () => number) => Engine }).BordinoDowrEngine;
const cards = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, text: `کارت ${i}`, category: "x", difficulty: 1, forbidden: [] }));
const make = (extra: object = {}) =>
	new Game({ mode: "classic", seconds: 30, rounds: 1, bombEnabled: 1, bombSeconds: 60, bombPenalty: 500, teams: [{ name: "الف", members: ["علی", "سارا"] }, { name: "ب", members: ["رضا", "مینا"] }], ...extra }, cards, () => 0.3);

describe("Dowr handoff", () => {
	it("private by default: the card waits for «گوشی دست منه», however long the handoff takes", () => {
		const g = make();
		g.tick(0);
		g.tick(60_000);
		expect([g.phase, g.current]).toEqual(["handoff", null]);
		expect(g.ready(60_000)).toBe(true);
		expect(g.phase).toBe("playing");
		const first = g.player;
		// a correct answer: the next player's card is hidden again, their time not started
		g.act("correct", 61_000);
		expect([g.phase, g.current, g.player !== first]).toEqual(["handoff", null, true]);
		g.tick(90_000);
		expect(g.phase).toBe("handoff");
		g.ready(90_000);
		// an invalid answer: the same
		g.act("foul", 91_000);
		expect([g.phase, g.current]).toEqual(["handoff", null]);
	});

	it("a swap keeps the same player's turn and costs 100", () => {
		const g = make({ bombEnabled: 0 });
		g.tick(0);
		g.ready(0);
		const [player, team, before] = [g.player, g.team, g.scores.slice()];
		const card = g.current?.text;
		g.act("skip", 1000);
		expect([g.phase, g.player, g.current?.text !== card]).toEqual(["playing", player, true]);
		expect(g.scores[team]).toBe(before[team] - 100);
	});

	it("after a timeout, «ادامه» hands over privately too", () => {
		const g = make({ bombEnabled: 0 });
		g.tick(0);
		g.ready(0);
		g.tick(31_000); // the 30 s ran out
		expect(g.phase).toBe("timedout");
		g.continueAfterTimeout(32_000);
		expect([g.phase, g.current]).toEqual(["handoff", null]);
	});

	it("the bomb keeps counting during a handoff once it has started, as configured", () => {
		const g = make();
		g.tick(0);
		expect(g.bombRuns).toBe(false); // not before the first turn
		g.ready(0);
		g.act("correct", 1000);
		expect([g.phase, g.bombRuns]).toEqual(["handoff", true]);
	});

	it("an immediate handoff (0 s) still shows the next card at once, when chosen", () => {
		const g = make({ handoffSeconds: 0 });
		g.tick(0);
		expect(g.phase).toBe("playing");
		g.act("correct", 1000);
		expect(g.phase).toBe("playing");
	});
});
