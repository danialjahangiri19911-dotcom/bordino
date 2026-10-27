import React from "react";

import EngineShell from "@/bd/EngineShell";
import theme from "@/libs/games/sudoku/theme";
import ThemeProvider from "@/libs/styles/ThemeProvider";

export default function SudokuLayout({ children }: { children: React.ReactNode }) {
	return (
		<EngineShell game="sudoku" title="سودوکو">
			<ThemeProvider theme={theme}>{children}</ThemeProvider>
		</EngineShell>
	);
}
