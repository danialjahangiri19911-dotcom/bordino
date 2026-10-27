import { useMemo } from "react";

import { BDN_PALETTE } from "./colorPalette";
import useFontVariants from "./fontVariants";
import { type Theme } from "@libs/styles/styled";
import { createTheme } from "@mui/material/styles";

interface Props {
	mode?: "light" | "dark";
	direction?: "rtl" | "ltr";
}

const useDynamicTheme = ({ direction = "rtl" }: Props = {}) => {
	// The remaining MUI pieces (toasts, the sudoku/2048/crash internals) stay light; the app's own
	// light/dark appearance is the neobrutalism stylesheet (src/bd).
	const mode = "light" as const;
	const defaultTheme = createTheme();
	const { typographyVariants } = useFontVariants();

	const theme = useMemo(() => {
		return {
			typography: {
				fontFamily: "shabnam,sans-serif",
				...typographyVariants,
			},
			bdn: {
				grey: {
					g25: "#F9F9F9",
					g50: "#F9FAFB",
					g100: "#F3F4F6",
					g200: "#E5E7EB",
					g500: "#6B7280",
					g525: "#525252",
					g550: "#3C3C3C",
					g600: "#353535",
					g650: "#2F2F2F",
					g700: "#374151",
					g800: "#1F2937",
					g900: "#0C0C0C",
				},
			},
			direction,
			palette: {
				mode,
				...BDN_PALETTE,
				text: {
					primary: "#111827",
				},
				blue: {
					400: "#60A5FA",
					800: "#0038FF",
					900: "#1C466E",
				},
				"primary-light": {
					200: "#FBE2E6",
					800: "#FF006B",
					900: "#AD3041",
				},
				"secondary-light": {
					200: "#DEE6ED",
				},
			},

			shadows: [
				"none",
				"0px 1px 3px 0px rgba(16, 24, 40, 0.1)",
				"0px 12px 16px -4px #10182814",
				"0px 1px 2.4px 0px #59545421",
				...defaultTheme.shadows.slice(3),
			] as Theme["shadows"],
		};
	}, [typographyVariants, direction, mode, defaultTheme.shadows]);

	return theme;
};

export default useDynamicTheme;
