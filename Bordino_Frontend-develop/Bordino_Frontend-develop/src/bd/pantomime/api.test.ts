import { gameReport } from "./api";
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
		expect(report.teams.map((t) => [t.name, t.rank, t.score, t.correct_elapsed_ms])).toEqual([
			["تیم B", 1, 1, 4001],
			["قرمز", 2, 0, 0],
		]);
		expect(report.teams[1].members).toEqual(["سارا", "بازیکن ۲"]);
		expect(report.turns).toEqual([
			{ team: 0, round: 1, player: "سارا", points: 0, cards: [{ text: "کلمه 0", result: "pass", elapsed_ms: 4001 }] },
			{ team: 1, round: 1, player: "بازیکن ۱", points: 1, cards: [{ text: "کلمه 1", result: "correct", elapsed_ms: 4001 }] },
		]);
	});
});
