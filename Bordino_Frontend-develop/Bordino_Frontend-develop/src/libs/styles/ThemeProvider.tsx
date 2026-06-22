"use client";

import { type ReactNode, useMemo } from "react";

import { Fonts } from "./Font";
import Rtl from "./Rtl";
import useDynamicTheme from "./useThemeGenerator";
import {
	ThemeProvider as MuiThemeProvider,
	type Theme,
	createTheme,
} from "@mui/material/styles";

interface Props {
	children: ReactNode;
	theme?: Theme;
}

export default function ThemeProvider({ children, theme }: Readonly<Props>) {
	const dynamicTheme = useDynamicTheme();
	const selectedTheme = useMemo(
		() => theme ?? createTheme(dynamicTheme),
		[dynamicTheme, theme],
	);
	return (
		<Rtl>
			<Fonts />
			<MuiThemeProvider theme={selectedTheme}>{children}</MuiThemeProvider>
		</Rtl>
	);
}
