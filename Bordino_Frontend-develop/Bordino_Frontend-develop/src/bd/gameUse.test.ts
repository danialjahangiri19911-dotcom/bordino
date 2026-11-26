import { gameAt, readGameUse, recordGameUse, sortByUse } from "./gameUse";
import { GAMES } from "./games";

describe("game order by use", () => {
	beforeEach(() => localStorage.clear());

	it("most opened first, then the most recent, then the usual order", () => {
		recordGameUse("p1", "spy", 1000);
		recordGameUse("p1", "game2048", 2000);
		recordGameUse("p1", "game2048", 3000);
		recordGameUse("p1", "dowr", 4000);
		const ids = sortByUse(GAMES, readGameUse("p1")).map((g) => g.id);
		expect(ids.slice(0, 3)).toEqual(["game2048", "dowr", "spy"]);
		// never opened: the catalog's own order
		expect(ids.slice(3)).toEqual(GAMES.map((g) => g.id).filter((id) => !["game2048", "dowr", "spy"].includes(id)));
	});

	it("each player has their own counts on a shared phone", () => {
		recordGameUse("p1", "spy");
		expect(sortByUse(GAMES, readGameUse("p2")).map((g) => g.id)).toEqual(GAMES.map((g) => g.id));
	});

	it("knows a game's pages, and nothing else", () => {
		expect(gameAt("/pwa/sudoku")).toBe("sudoku");
		expect(gameAt("/pwa/2048/")).toBe("game2048");
		expect(gameAt("/pwa/gameNet")).toBeNull();
		expect(gameAt("/pwa/spyglass")).toBeNull();
	});
});
