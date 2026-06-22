import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeModeProps {
	mode: "dark" | "light";
	changeMode: (isDark: boolean) => void;
}

const useThemeModeStore = create(
	persist<ThemeModeProps>(
		(set) => ({
			mode: "light",
			changeMode: (isDark) => set({ mode: isDark ? "dark" : "light" }),
		}),
		{
			name: "lt-theme-store",
		},
	),
);

export default useThemeModeStore;
