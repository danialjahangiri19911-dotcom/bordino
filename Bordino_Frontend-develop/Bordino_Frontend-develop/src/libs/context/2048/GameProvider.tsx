"use client";

import type { ReactNode } from "react";
import { createContext, useEffect, useRef } from "react";

import debounce from "lodash.debounce";

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

	const debouncedSave = useRef(
		debounce((stateToSave: GameContextValue) => {
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

	return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}
