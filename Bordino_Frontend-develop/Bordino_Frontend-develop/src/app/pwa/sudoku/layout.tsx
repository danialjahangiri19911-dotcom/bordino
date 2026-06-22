import React from "react";

import PwaAppLayout from "@/libs/components/layouts/PwaAppLayout";
import theme from "@/libs/games/sudoku/theme";
import ThemeProvider from "@/libs/styles/ThemeProvider";

export default async function SudokuLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ThemeProvider theme={theme}>
			<PwaAppLayout>{children}</PwaAppLayout>
		</ThemeProvider>
	);
}
