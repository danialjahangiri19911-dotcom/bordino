import { REPORT_CARDS, REPORT_TURN_CARDS, gameReport } from "./api";
import { Game } from "./engine";

describe("the finished game sent to the server", () => {
	it("is the ranking (in order, with members) and every turn's cards", () => {
		const g = new Game({ teams: ["قرمز", ""], members: [["سارا", ""], ["", ""]], seconds: 90, rounds: 1, format: "challenge" }, []);
		for (const [t, kind] of [[0, "pass"], [1, "correct"]] as const) {
			g.propose("کلمه " + t, 30);
			g.approve();
			g.start(t * 100000);
			g.answer(kind, t * 100000 + 4000.6);
			g.next();
		}
		const report = gameReport("id-1", g.result());
		expect(report.request_id).toBe("id-1");
		// In the game's order (B won): every turn still points at its own team.
		expect(report.teams.map((t) => [t.name, t.rank, t.score, t.correct_elapsed_ms])).toEqual([
			["قرمز", 2, 0, 0],
			["تیم B", 1, 1, 4001],
		]);
		expect(report.teams[report.turns[0].team].members).toEqual(["سارا", "بازیکن ۲"]);
		expect(report.turns).toEqual([
			{ team: 0, round: 1, player: "سارا", points: 0, cards_total: 1, cards: [{ text: "کلمه 0", result: "pass", elapsed_ms: 4001 }] },
			{ team: 1, round: 1, player: "بازیکن ۱", points: 1, cards_total: 1, cards: [{ text: "کلمه 1", result: "correct", elapsed_ms: 4001 }] },
		]);
	});

	it("keeps the first cards of a very long turn, and the true count", () => {
		const cards = Array.from({ length: 30 }, (_, i) => ({ id: String(i), category: "daily", difficulty: 1, text: "c" + i }));
		const g = new Game({ teams: ["a", "b"], seconds: 900, rounds: 6, format: "marathon" }, cards, { random: () => 0 });
		for (let turn = 0; turn < 12; turn++) {
			g.start(turn * 1e6);
			for (let i = 0; i < 250; i++) g.answer(i % 2 ? "pass" : "correct", turn * 1e6 + i * 1000 + 1);
			g.finish();
			g.next();
		}
		const report = gameReport("long", g.result());
		expect(report.turns[0].cards.length).toBe(REPORT_TURN_CARDS);
		expect(report.turns[0].cards_total).toBe(250);
		expect(report.turns.reduce((n, t) => n + t.cards.length, 0)).toBe(REPORT_CARDS);
		expect(report.turns[11].cards.length).toBe(0);
		expect(report.turns[11].cards_total).toBe(250);
	});
});
