"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useEffect, useRef, useState } from "react";

import debounce from "lodash.debounce";

import useChargeGamePlay from "@/api/games/useChargeGamePlay";
import type { StoredGameState } from "@/libs/games/2048/persistence";
import { saveGame } from "@/libs/games/2048/persistence";
import type { Direction, GameState } from "@/libs/games/2048/types";
import { use2048 } from "@/libs/hooks/use2048";

interface GameContextValue extends GameState {
	move: (direction: Direction) => void;
	startGame: () => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	history: any[];
	historyIndex: number;
	isLoading?: boolean;
	/** Every new game goes through here: the play is charged, then the board starts. */
	startPaidGame: () => Promise<boolean>;
	isCharging: boolean;
	/** No paid game on the board yet (first visit without a saved game): show "start". */
	needsStart: boolean;
}

export const GameContext = createContext<GameContextValue | undefined>(
	undefined,
);

interface GameProviderProps {
	children: ReactNode;
	initialState?: StoredGameState | null;
}

export default function GameProvider({
	children,
	initialState,
}: GameProviderProps) {
	const game = use2048(initialState);
	const { chargeAsync, isCharging } = useChargeGamePlay();
	// A saved game was paid for when it started; a fresh board was not.
	const [needsStart, setNeedsStart] = useState(!initialState);
	const startGameRef = useRef(game.startGame);
	startGameRef.current = game.startGame;
	const chargingRef = useRef(false);

	const startPaidGame = useCallback(async () => {
		if (chargingRef.current) return false; // one start at a time (double tap)
		chargingRef.current = true;
		try {
			await chargeAsync({ game_name: "game_2048" });
			startGameRef.current();
			setNeedsStart(false);
			return true;
		} catch {
			// خطا (مثلِ امتیازِ ناکافی) توسطِ toastِ سراسری نمایش داده می‌شود
			return false;
		} finally {
			chargingRef.current = false;
		}
	}, [chargeAsync]);

	const debouncedSave = useRef(
		debounce((stateToSave: ReturnType<typeof use2048>) => {
			// Only save if not loading and state is valid
			if (!stateToSave || stateToSave.isLoading) return;
			const stored: StoredGameState = {
				version: 1,
				lastSaved: Date.now(),
				board: stateToSave.board,
				tiles: stateToSave.tiles,
				tilesByIds: stateToSave.tilesByIds,
				score: stateToSave.score,
				moveCount: stateToSave.moveCount,
				status: stateToSave.status,
				timeRemaining: stateToSave.timeRemaining,
				history: stateToSave.history,
				historyIndex: stateToSave.historyIndex,
			};
			saveGame(stored);
		}, 1000),
	).current;

	useEffect(() => {
		if (game && !game.isLoading) {
			debouncedSave(game);
		}
		return () => {
			debouncedSave.cancel();
		};
	}, [game, debouncedSave]);

	return (
		<GameContext.Provider value={{ ...game, startPaidGame, isCharging, needsStart }}>
			{children}
		</GameContext.Provider>
	);
}
