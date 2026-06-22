import { useCallback, useEffect, useRef, useState } from "react";

import { mergeAnimationDuration } from "@/constants/2048";
import { GameEngine } from "@/libs/games/2048/engine";
import type { StoredGameState } from "@/libs/games/2048/persistence";
import type { Direction, GameState } from "@/libs/games/2048/types";

export function use2048(initialState?: StoredGameState | null) {
	const engineRef = useRef<GameEngine | null>(null);
	const unsubscribeRef = useRef<(() => void) | null>(null);
	const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [gameState, setGameState] = useState<{
		state: GameState | null;
		isLoading: boolean;
	}>({ state: null, isLoading: true });

	// Initialize engine
	useEffect(() => {
		let mounted = true;
		const engine = new GameEngine();
		engineRef.current = engine;

		try {
			if (initialState) {
				engine.hydrate(initialState, initialState.lastSaved);
			} else {
				engine.startGame();
			}
		} catch (error) {
			console.error("Failed to initialize game, starting fresh:", error);
			engine.startGame(); // fallback
		}

		const unsubscribe = engine.subscribe((newState) => {
			if (mounted) {
				setGameState({ state: newState, isLoading: false });
			}
		});
		unsubscribeRef.current = unsubscribe;

		// If engine didn't notify immediately (should not happen), force a read
		const currentState = engine.getState();
		if (mounted && currentState) {
			setGameState({ state: currentState, isLoading: false });
		}

		return () => {
			mounted = false;
			if (unsubscribeRef.current) {
				unsubscribeRef.current();
				unsubscribeRef.current = null;
			}
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [initialState]); // Re-run if initialState changes (e.g., after load)

	const { state, isLoading } = gameState;

	// Timer interval – only when game is ongoing and not loading
	const manageInterval = useCallback(() => {
		if (!engineRef.current || !state || isLoading) return;

		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (state.status === "ongoing" && document.visibilityState === "visible") {
			intervalRef.current = setInterval(() => {
				engineRef.current?.tick();
			}, 1000);
		}
	}, [state, isLoading]);

	useEffect(() => {
		manageInterval();

		const onVisibilityChange = () => {
			manageInterval();
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [manageInterval]);

	// After a move that changed the board, schedule cleanup, new tile, and commit history
	useEffect(() => {
		if (state?.hasChanged) {
			const timer = setTimeout(() => {
				engineRef.current?.cleanup();
				engineRef.current?.addRandomTile();
				engineRef.current?.commitMove();
			}, mergeAnimationDuration);
			return () => clearTimeout(timer);
		}
	}, [state?.hasChanged]);

	// If still loading, return a placeholder with isLoading true
	if (isLoading || !state) {
		return {
			isLoading: true,
			board: [],
			tiles: {},
			tilesByIds: [],
			score: 0,
			moveCount: 0,
			status: "ongoing" as const,
			timeRemaining: 0,
			history: [],
			historyIndex: -1,
			historyLength: 0,
			canUndo: false,
			canRedo: false,
			move: (direction: Direction) => engineRef.current?.move(direction),
			startGame: () => engineRef.current?.startGame(),
			undo: () => engineRef.current?.undo(),
			redo: () => engineRef.current?.redo(),
		};
	}

	const canUndo = state.historyIndex > 0;
	const canRedo = state.historyIndex < state.historyLength - 1;

	// Get history from engine (engine may have more up-to-date history than state)
	const history = engineRef.current ? engineRef.current.getHistory() : [];
	const historyIndex = engineRef.current
		? engineRef.current.getHistoryIndex()
		: -1;

	return {
		...state,
		history,
		historyIndex,
		isLoading: false,
		move: (direction: Direction) => engineRef.current?.move(direction),
		startGame: () => engineRef.current?.startGame(),
		undo: () => engineRef.current?.undo(),
		redo: () => engineRef.current?.redo(),
		canUndo,
		canRedo,
	};
}
