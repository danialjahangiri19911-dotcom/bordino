import { del, get, set } from "idb-keyval";

import { currentUserId } from "@/libs/stores/authStore";

export interface StoredGameState {
	version: 1;
	lastSaved: number; // timestamp in milliseconds
	board: (string | undefined)[][];
	tiles: Record<
		string,
		{ id: string; position: [number, number]; value: number }
	>;
	tilesByIds: string[];
	score: number;
	moveCount: number;
	status: "ongoing" | "won" | "lost";
	timeRemaining: number; // snapshot of timer at save moment
	history: Array<{
		board: (string | undefined)[][];
		tiles: Record<
			string,
			{ id: string; position: [number, number]; value: number }
		>;
		tilesByIds: string[];
		score: number;
		moveCount: number;
		status: "ongoing" | "won" | "lost";
	}>;
	historyIndex: number;
}

// One save per account on a shared device (the old key held whoever played last).
const storageKey = () => `gameState:${currentUserId()}`;
const CURRENT_VERSION = 1;

export async function saveGame(state: StoredGameState): Promise<void> {
	try {
		await set(storageKey(), state);
	} catch (error) {
		console.error("Failed to save game state to IndexedDB:", error);
	}
}

export async function loadGame(): Promise<StoredGameState | null> {
	try {
		const data = await get<StoredGameState>(storageKey());
		if (!data) return null;
		if (data.version !== CURRENT_VERSION) {
			// Version mismatch – discard (could migrate later)
			await del(storageKey());
			return null;
		}
		return data;
	} catch (error) {
		console.error("Failed to load game state from IndexedDB:", error);
		return null;
	}
}

export async function clearGame(): Promise<void> {
	try {
		await del(storageKey());
	} catch (error) {
		console.error("Failed to clear game state:", error);
	}
}
