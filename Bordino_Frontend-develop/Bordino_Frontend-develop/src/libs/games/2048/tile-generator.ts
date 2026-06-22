import type { Tile } from "./types";
import { uid } from "uid";

export function createRandomTile(position: [number, number]): Tile {
	return {
		id: uid(),
		position,
		value: 2, // always start with 2
	};
}
