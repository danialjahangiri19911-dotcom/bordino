/* eslint-disable @typescript-eslint/no-empty-object-type */
import { type CSSProperties } from "react";

import type { PaletteColor } from "@mui/material/styles";

interface ExtraColors {
	blueGray?: string;
	cyan?: string;
	cream?: string;
	yellow?: string;
	blueDark?: string;
}

interface BdColorsPalette {
	50: string;
	100: string;
	200: string;
	300: string;
	400: string;
	500: string;
	600: string;
	700: string;
	800: string;
	900: string;
}

interface BdnGrey {
	g25: string;
	g50: string;
	g100: string;
	g200: string;
	g500: string;
	g525: string;
	g550: string;
	g600: string;
	g650: string;
	g700: string;
	g800: string;
	g900: string;
}

type FontSize =
	| "11"
	| "12"
	| "14"
	| "16"
	| "18"
	| "20"
	| "23"
	| "24"
	| "28"
	| "36";
type FontWeight = "regular" | "medium" | "bold";
type TypographyVariant = `${FontSize}-${FontWeight}`;

declare module "@mui/material/styles" {
	interface TypographyVariants extends Record<
		TypographyVariant,
		CSSProperties
	> {}

	interface TypographyVariantsOptions extends Partial<
		Record<TypographyVariant, CSSProperties>
	> {}

	interface PaletteColor extends BdColorsPalette {}

	interface Palette {
		extra: ExtraColors;
		"primary-light": Partial<BdColorsPalette>;
		blue: Partial<BdColorsPalette>;
		"secondary-light": Partial<BdColorsPalette>;
	}

	interface PaletteOptions {
		extra?: ExtraColors;
		"primary-light"?: Partial<BdColorsPalette>;
		blue?: Partial<BdColorsPalette>;
		"secondary-light"?: Partial<BdColorsPalette>;
	}

	interface Theme {
		bdn?: {
			grey: BdnGrey;
		};
	}

	interface ThemeOptions {
		bdn?: {
			grey: Partial<BdnGrey>;
		};
	}
}

declare module "@mui/material/Typography" {
	interface TypographyPropsVariantOverrides extends Record<
		TypographyVariant,
		true
	> {}
}

export interface PaletteProps {
	primary: PaletteColor;
	secondary: PaletteColor;
	warning: PaletteColor;
	error: PaletteColor;
	success: PaletteColor;
	info: PaletteColor;
}
