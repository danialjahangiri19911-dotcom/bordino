import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the player picked in «ظاهر برنامه»: a fixed scheme, or follow the device. */
export type Appearance = "light" | "dark" | "system";

interface ThemeModeProps {
	mode: Appearance;
	setMode: (mode: Appearance) => void;
	changeMode: (isDark: boolean) => void;
}

// The stored key and shape are read before React starts (APPEARANCE_SCRIPT in src/bd/appearance.ts),
// so the first paint is already in the right scheme: keep them in step.
const useThemeModeStore = create(
	persist<ThemeModeProps>(
		(set) => ({
			mode: "system",
			setMode: (mode) => set({ mode }),
			changeMode: (isDark) => set({ mode: isDark ? "dark" : "light" }),
		}),
		{
			name: "lt-theme-store",
		},
	),
);

export default useThemeModeStore;
