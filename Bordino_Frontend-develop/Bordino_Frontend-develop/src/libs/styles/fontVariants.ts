import { useMemo } from "react";

interface FontSize {
	fontSize: number;
	lineHeight: string;
}

interface TypographyVariant {
	fontSize: number;
	lineHeight: string;
	fontWeight: number;
}

const fontSizes: FontSize[] = [
	{ fontSize: 11, lineHeight: "16.5px" },
	{ fontSize: 12, lineHeight: "18px" },
	{ fontSize: 14, lineHeight: "20px" },
	{ fontSize: 16, lineHeight: "24px" },
	{ fontSize: 18, lineHeight: "27px" },
	{ fontSize: 20, lineHeight: "31px" },
	{ fontSize: 23, lineHeight: "35px" },
	{ fontSize: 24, lineHeight: "33px" },
	{ fontSize: 28, lineHeight: "38px" },
	{ fontSize: 32, lineHeight: "42px" },
	{ fontSize: 36, lineHeight: "44px" },
	{ fontSize: 40, lineHeight: "55px" },
];

const fontWeights: Record<string, number> = {
	regular: 400,
	medium: 500,
	bold: 700,
};

// According to the implementation of the design system, the system fonts have been implemented this way.
// If any issues arise or changes are required, keep in mind that it follows the design.
export default function useFontVariants() {
	const typographyVariants: Record<string, TypographyVariant> = useMemo(() => {
		return fontSizes.reduce(
			(acc, size) => {
				Object.entries(fontWeights).forEach(([weightName, weightValue]) => {
					acc[`${size.fontSize}-${weightName}`] = {
						fontSize: size.fontSize,
						lineHeight: size.lineHeight,
						fontWeight: weightValue,
					};
				});
				return acc;
			},
			{} as Record<string, TypographyVariant>,
		);
	}, []);

	return { typographyVariants };
}
