import { act } from "react";
import { createRoot } from "react-dom/client";

import { use2048 } from "./use2048";
import type { StoredGameState } from "@/libs/games/2048/persistence";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A saved 4×4 game: `cells` maps [x, y] to a tile value. */
function saved(cells: [number, number, number][]): StoredGameState {
	const board: (string | undefined)[][] = Array.from({ length: 4 }, () => Array(4).fill(undefined));
	const tiles: StoredGameState["tiles"] = {};
	cells.forEach(([x, y, value], i) => {
		const id = `t${i}`;
		board[y][x] = id;
		tiles[id] = { id, position: [x, y], value };
	});
	const snap = { board, tiles, tilesByIds: Object.keys(tiles), score: 0, moveCount: 0, status: "ongoing" as const };
	return { version: 1, lastSaved: Date.now(), ...snap, timeRemaining: 0, history: [snap], historyIndex: 0 };
}

function play(init: StoredGameState) {
	let api!: ReturnType<typeof use2048>;
	function Probe() {
		api = use2048(init);
		return null;
	}
	const root = createRoot(document.createElement("div"));
	act(() => root.render(<Probe />));
	return { get: () => api, root };
}

describe("2048 ends the game after a move (Codex audit phase 4)", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("making 2048 wins", () => {
		const g = play(saved([[0, 0, 1024], [1, 0, 1024]]));
		act(() => g.get().move("left"));
		act(() => jest.advanceTimersByTime(500));
		expect(g.get().status).toBe("won");
		act(() => g.root.unmount());
	});

	it("a full board with no move left loses (and undo can step back from it)", () => {
		// No equal neighbours anywhere; moving left slides the last row over and the new 2/4 fills
		// the only free cell, next to 512 and under 64: no move is left.
		const rows = [
			[8, 16, 32, 64],
			[128, 256, 512, 1024],
			[8, 16, 32, 64],
			[0, 128, 256, 512],
		];
		const cells = rows.flatMap((row, y) => row.map((v, x) => [x, y, v] as [number, number, number])).filter(([, , v]) => v);
		const g = play(saved(cells));
		act(() => g.get().move("left"));
		act(() => jest.advanceTimersByTime(500));
		expect(g.get().status).toBe("lost");
		expect(g.get().canUndo).toBe(true);
		act(() => g.root.unmount());
	});
});
