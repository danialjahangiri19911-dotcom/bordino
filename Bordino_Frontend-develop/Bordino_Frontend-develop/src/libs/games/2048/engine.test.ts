import { GameEngine } from "./engine";

describe("2048 has no time limit", () => {
	it("keeps a game going however many seconds pass", () => {
		const engine = new GameEngine();
		engine.startGame();
		for (let i = 0; i < 1000; i++) engine.tick();
		expect(engine.getState().status).toBe("ongoing");
	});

	it("resumes a saved game as it was, even days later", () => {
		const engine = new GameEngine();
		engine.startGame();
		const { timeRemaining: _ignored, ...state } = engine.getState();
		const daysAgo = Date.now() - 3 * 24 * 3600 * 1000;
		engine.hydrate(
			{ ...state, timeRemaining: 0, history: engine.getHistory() } as unknown as Parameters<GameEngine["hydrate"]>[0],
			daysAgo,
		);
		expect(engine.getState().status).toBe("ongoing");
	});
});
