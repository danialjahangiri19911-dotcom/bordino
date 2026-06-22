// Animation durations (ms)
export const mergeAnimationDuration = 100;
export const moveAnimationDuration = 200;

// Re-export engine constants with the names expected by components
export {
	TILE_COUNT_PER_DIMENSION,
	GAME_WIN_TILE_VALUE,
	INITIAL_TIME,
} from "@/libs/games/2048/constants";

// Container widths (for tile positioning)
export const containerWidthMobile = 288; // px
export const containerWidthDesktop = 464; // px

// History
export const MAX_HISTORY_SIZE = 30;
