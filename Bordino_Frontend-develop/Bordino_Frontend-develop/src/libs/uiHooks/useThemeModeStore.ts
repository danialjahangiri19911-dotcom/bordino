import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the player picked in «ظاهر برنامه»: a fixed scheme, or follow the device. */
export type Appearance = "light" | "dark" | "system";

/**
 * The app's look (its design style): neobrutalism «پوستر قرمز» (the default, brutal-a), neon
 * «نبض بنفش» (neon-a, always dark) or neumorphism «نرم و روشن» (neu-a).
 */
export type BdStyle = "brutal" | "neon" | "neu";
export const BD_STYLES: readonly BdStyle[] = ["brutal", "neon", "neu"];

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
			style: "brutal",
			setMode: (mode) => set({ mode }),
			setStyle: (style) => set({ style: BD_STYLES.includes(style) ? style : "brutal" }),
			changeMode: (isDark) => set({ mode: isDark ? "dark" : "light" }),
		}),
		{
			name: "lt-theme-store",
		},
	),
);

export default useThemeModeStore;
