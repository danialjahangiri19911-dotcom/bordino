import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the player picked in «ظاهر برنامه»: a fixed scheme, or follow the device. */
export type Appearance = "light" | "dark" | "system";

/**
 * The app's look (its design style): neobrutalism «پوستر قرمز» (brutal-a), neon «نبض بنفش» (neon-a,
 * always dark) or neumorphism «نرم و روشن» / «اسمورفی» (neu-a, the default since 2026-11-26).
 */
export type BdStyle = "brutal" | "neon" | "neu";
export const BD_STYLES: readonly BdStyle[] = ["brutal", "neon", "neu"];
export const DEFAULT_STYLE: BdStyle = "neu";

interface ThemeModeProps {
	mode: Appearance;
	style: BdStyle;
	setMode: (mode: Appearance) => void;
	setStyle: (style: BdStyle) => void;
	changeMode: (isDark: boolean) => void;
}

// The stored key and shape are read before React starts (APPEARANCE_SCRIPT in src/bd/appearance.ts),
// so the first paint is already in the right scheme: keep them in step.
const useThemeModeStore = create(
	persist<ThemeModeProps>(
		(set) => ({
			mode: "system",
			style: DEFAULT_STYLE,
			setMode: (mode) => set({ mode }),
			setStyle: (style) => set({ style: BD_STYLES.includes(style) ? style : DEFAULT_STYLE }),
			changeMode: (isDark) => set({ mode: isDark ? "dark" : "light" }),
		}),
		{
			name: "lt-theme-store",
			// v1 (2026-11-26): the default became neumorphism. A stored «brutal» from before was the old
			// default for nearly everyone (changing only light/dark stored it too): it moves to the new
			// default; a picked neon or neumorphism stays. (APPEARANCE_SCRIPT does the same before React.)
			version: 1,
			migrate: (stored, version) => {
				const state = (stored ?? {}) as ThemeModeProps;
				if (version < 1 && (state.style === "brutal" || !state.style)) state.style = DEFAULT_STYLE;
				return state;
			},
		},
	),
);

export default useThemeModeStore;
