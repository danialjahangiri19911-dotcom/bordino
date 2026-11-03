/**
 * The design's engine suites (test.cjs, test-challenge.cjs), assertion for assertion, against the
 * port: the same rules must hold (the weights now come from the server, as the admin sets them).
 */
import { DEFAULT_LIMITS, Game, pointsFor } from "./engine";
import { CARDS as cards, CATEGORIES, WEIGHTS } from "./engine.fixture";

const weights = WEIGHTS;
const opts = (random?: () => number) => ({ random, weights });
const cfg = { teams: ["الف", "ب"], seconds: 30, rounds: 2, mode: "classic" as const };

describe("pantomime engine (design test.cjs)", () => {
	it("has the 180 cards, validates, scores, keeps the deadline, pauses, rotates and ties", () => {
		expect(cards.length).toBe(180);
		expect(new Set(cards.map((x) => x.id)).size).toBe(180);
		expect(new Set(cards.map((x) => x.text)).size).toBe(180);
		for (const c of CATEGORIES) for (let d = 1; d <= 3; d++) expect(cards.filter((x) => x.category === c && x.difficulty === d).length).toBe(10);
		expect(() => new Game({ ...cfg, teams: ["الف"] }, cards)).toThrow();
		expect(() => new Game(cfg, [])).toThrow();
		let game = new Game(cfg, cards, opts(() => 0.5));
		expect(game.current).toBeNull();
		game.start(1000);
		const first = game.current!.id;
		game.answer("correct", 1500);
		expect(game.scores[0]).toBe(1);
		expect(game.current!.id).not.toBe(first);
		game.answer("pass", 1700);
		expect(game.scores[0]).toBe(1);
		game.pause(2000);
		expect(game.remaining).toBe(29000);
		game.tick(50000);
		expect(game.remaining).toBe(29000);
		expect(game.answer("correct", 50000)).toBe(false);
		game.resume(60000);
		game.tick(88999);
		expect(game.phase).toBe("playing");
		expect(game.answer("correct", 89000)).toBe(false);
		expect(game.phase).toBe("summary");
		expect(game.scores[0]).toBe(1);
		game.tick(100000);
		expect(game.history.length).toBe(1);
		game.next();
		expect(game.team).toBe(1);
		expect(game.current).toBeNull();
		for (let i = 1; i < 4; i++) {
			game.start(i * 100000);
			game.answer("correct", i * 100000 + 100);
			game.tick(i * 100000 + 30000);
			game.next();
		}
		expect(game.phase).toBe("finished");
		expect(game.scores).toEqual([2, 2]);
		expect(game.history.length).toBe(4);
		game = new Game({ ...cfg, seconds: 120 }, cards.slice(0, 10), opts(() => 0.6));
		game.start(0);
		const seen = new Set([game.current!.id]);
		for (let i = 0; i < 9; i++) {
			game.answer("pass", i + 1);
			seen.add(game.current!.id);
		}
		expect(seen.size).toBe(10);
		const previous = game.current!.id;
		game.answer("pass", 20);
		expect(game.current!.id).not.toBe(previous);
		game.finish();
		const result = game.result();
		result.scores[0] = 999;
		expect(game.scores[0]).toBe(0);
	});

	it("roster defaults, time limits, the duel score formula, per-turn choice, ranking and result isolation", () => {
		let duel = new Game(
			{ ...cfg, format: "duel", teams: [" ", "Blue", ""], members: [["", "Ali"], ["", ""], ["", "", ""]], seconds: 900, rounds: 3 },
			cards,
			opts(() => 0.2),
		);
		expect(duel.config.teams[0]).toBe("تیم A");
		expect(duel.config.teams[2]).toBe("تیم C");
		expect(duel.player).toBe("بازیکن ۱");
		expect(duel.current).toBeNull();
		expect(duel.phase).toBe("choice");
		expect(duel.start(0)).toBe(false);
		expect(() => duel.choose("custom", 3)).toThrow();
		expect(duel.phase).toBe("choice");
		expect(pointsFor(weights.jobs, 2, 45000, 90000)).toEqual({ base: 240, bonus: 120, points: 360 });
		expect(pointsFor(weights.phrases, 3, 90000, 90000).points).toBe(960);
		expect(pointsFor(weights.daily, 1, 0, 90000).points).toBe(100);
		expect(() => new Game({ ...cfg, seconds: 901 }, cards)).toThrow();
		expect(() => new Game({ ...cfg, members: [["solo"], ["", ""]] }, cards)).toThrow();

		duel = new Game({ ...cfg, format: "duel", teams: ["", ""], members: [["A1", "A2"], ["B1", "B2"]], seconds: 60, rounds: 2 }, cards, opts(() => 0.2));
		duel.choose("jobs", 2);
		expect(duel.current).toBeNull();
		expect(duel.revise()).toBe(true);
		duel.choose("phrases", 3);
		duel.start(0);
		expect(duel.current!.category).toBe("phrases");
		expect(duel.current!.difficulty).toBe(3);
		duel.pause(10000);
		duel.resume(100000);
		duel.answer("correct", 110000);
		expect(duel.scores[0]).toBe(800);
		expect(duel.phase).toBe("summary");
		expect(duel.log.length).toBe(1);
		expect(duel.history[0].cards[0].elapsedMs).toBe(20000);
		expect(duel.answer("correct", 110001)).toBe(false);
		expect(duel.history.length).toBe(1);
		duel.next();
		expect(duel.phase).toBe("choice");
		expect(duel.team).toBe(1);
		expect(duel.selection).toBeNull();
		duel.choose("animals", 1);
		duel.start(200000);
		duel.answer("pass", 201000);
		expect(duel.scores[1]).toBe(0);
		expect(duel.phase).toBe("summary");
		duel.next();
		expect(duel.player).toBe("A2");
		duel.choose("sports", 1);
		duel.start(300000);
		expect(duel.answer("correct", 360000)).toBe(false);
		expect(duel.log[0].result).toBe("timeout");
		expect(duel.scores[0]).toBe(800);
		duel.next();
		expect(duel.player).toBe("B2");
		duel.choose("daily", 1);
		duel.start(400000);
		duel.answer("correct", 430000);
		expect(duel.scores[1]).toBe(150);
		duel.next();
		expect(duel.phase).toBe("finished");
		expect(duel.ranking().map((r) => r.score)).toEqual([800, 150]);
		expect(duel.history.length).toBe(4);
		const snapshot = duel.result();
		snapshot.members[0][0] = "changed";
		expect(duel.config.members[0][0]).toBe("A1");
		snapshot.history[0].selection!.category = "changed";
		expect(duel.history[0].selection!.category).toBe("phrases");

		const ranked = new Game({ ...cfg, teams: ["A", "B", "C", "D"] }, cards);
		ranked.scores = [10, 40, 40, 5];
		expect(ranked.ranking().map((r) => r.rank)).toEqual([1, 1, 3, 4]);
		expect(ranked.ranking()[0].name).toBe("B");

		const cycle = new Game({ ...cfg, format: "duel", rounds: 10 }, cards, opts(() => 0.1));
		const ids = new Set<string>();
		for (let i = 0; i < 10; i++) {
			cycle.choose("daily", 1);
			cycle.start(i * 100000);
			ids.add(cycle.current!.id);
			cycle.answer("pass", i * 100000 + 1000);
			cycle.next();
		}
		expect(ids.size).toBe(10);
	});
});

describe("pantomime engine (design test-challenge.cjs)", () => {
	const ch = { teams: ["A", "B"], members: [["A1", "A2"], ["B1", "B2"]], seconds: 90, rounds: 2, format: "challenge" as const };

	it("gates proposals, keeps each turn's time, scores 1/0 and breaks ties by time", () => {
		const game = new Game(ch, []);
		expect(game.phase).toBe("proposal");
		expect(game.proposer).toBe(1);
		expect(game.start(0)).toBe(false);
		expect(game.approve()).toBe(false);
		expect(() => game.propose("", 60)).toThrow();
		expect(() => game.propose("a", 9)).toThrow();
		expect(() => game.propose("a", 901)).toThrow();
		expect(() => game.propose("a", 20.5)).toThrow();
		game.propose("secret", 60);
		expect(game.phase).toBe("approval");
		expect(game.current).toBeNull();
		expect(game.start(0)).toBe(false);
		expect(game.reject()).toBe(true);
		game.propose("revised", 120);
		game.approve();
		expect(game.turnSeconds).toBe(120);
		expect(game.current).toBeNull();
		expect(game.propose("late", 40)).toBe(false);
		game.start(0);
		expect(game.current!.text).toBe("revised");
		game.pause(10000);
		game.resume(100000);
		game.answer("correct", 110000);
		expect(game.scores[0]).toBe(1);
		expect(game.history[0].cards[0].elapsedMs).toBe(20000);
		expect(game.phase).toBe("summary");
		expect(game.answer("correct", 110001)).toBe(false);
		game.next();
		expect(game.phase).toBe("proposal");
		expect(game.proposer).toBe(0);
		expect(game.proposal).toBeNull();
		game.propose("second", 60);
		game.approve();
		game.start(200000);
		game.answer("correct", 215000);
		game.next();
		expect(game.player).toBe("A2");
		game.propose("third", 10);
		game.approve();
		game.start(300000);
		expect(game.answer("correct", 310000)).toBe(false);
		expect(game.history[2].cards[0].result).toBe("timeout");
		game.next();
		game.propose("fourth", 900);
		game.approve();
		game.start(400000);
		game.answer("pass", 400500);
		game.next();
		expect(game.phase).toBe("finished");
		expect(game.scores).toEqual([1, 1]);
		expect(game.ranking()[0].name).toBe("B");
		expect(game.ranking()[0].correctElapsedMs).toBe(15000);
		expect(game.ranking()[1].correctElapsedMs).toBe(20000);
		expect(game.history[2].seconds).toBe(10);
		expect(game.history[3].seconds).toBe(900);
	});

	it("shares ranks on full ties and gives every team one proposing turn per round", () => {
		const tie = new Game({ ...ch, rounds: 1 }, []);
		for (let t = 0; t < 2; t++) {
			tie.propose("x", 30);
			tie.approve();
			tie.start(t * 100000);
			tie.answer("correct", t * 100000 + 5000);
			tie.next();
		}
		expect(tie.ranking().map((r) => r.rank)).toEqual([1, 1]);
		const fail = new Game({ ...ch, rounds: 1 }, []);
		for (let t = 0; t < 2; t++) {
			fail.propose("x", 30);
			fail.approve();
			fail.start(t * 100000);
			fail.answer("pass", t * 100000 + 5000 + t * 1000);
			fail.next();
		}
		expect(fail.ranking().map((r) => r.rank)).toEqual([1, 1]);
		const multi = new Game({ ...ch, teams: ["A", "B", "C"], members: undefined, rounds: 1 }, []);
		const proposers: number[] = [];
		const receivers: number[] = [];
		for (let i = 0; i < 3; i++) {
			proposers.push(multi.proposer);
			receivers.push(multi.team);
			multi.propose("x", 30);
			multi.approve();
			multi.start(i * 100000);
			multi.answer("pass", i * 100000 + 1000);
			multi.next();
		}
		expect(proposers).toEqual([2, 0, 1]);
		expect(receivers).toEqual([0, 1, 2]);
		expect(multi.phase).toBe("finished");
	});
});

describe("pantomime engine (the admin's limits)", () => {
	it("applies the limits the server sends", () => {
		const limits = { ...DEFAULT_LIMITS, turnSeconds: [60, 300] as [number, number], challengeSeconds: [20, 120] as [number, number], maxRounds: 3, maxTeams: 3, maxMembers: 4 };
		expect(() => new Game({ ...cfg, seconds: 30 }, cards, { limits })).toThrow();
		expect(() => new Game({ ...cfg, seconds: 60, rounds: 4 }, cards, { limits })).toThrow();
		expect(() => new Game({ ...cfg, seconds: 60, teams: ["a", "b", "c", "d"] }, cards, { limits })).toThrow();
		expect(() => new Game({ ...cfg, seconds: 60, members: [["", "", "", "", ""], ["", ""]] }, cards, { limits })).toThrow();
		const game = new Game({ ...cfg, seconds: 60, format: "challenge" }, [], { limits });
		expect(() => game.propose("a", 10)).toThrow();
		expect(() => game.propose("a", 121)).toThrow();
		expect(game.propose("a", 120)).toBe(true);
	});
});
