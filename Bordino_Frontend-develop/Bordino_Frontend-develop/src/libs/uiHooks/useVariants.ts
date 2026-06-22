import { useCallback } from "react";

import { useDevice } from "./device";
import type { TypographyProps } from "@libs/components/atoms/Typography";

export default function useVariants() {
	const { isMobile, isTablet } = useDevice();
	type Variants = TypographyProps["variant"];

	const getVariant = useCallback(
		(mobile: Variants, tablet: Variants, desktop: Variants): Variants => {
			if (isMobile) return mobile;
			if (isTablet) return tablet;
			return desktop;
		},
		[isMobile, isTablet],
	);

	const bold11 = getVariant("11-bold", "12-bold", "14-bold");
	const bold14 = getVariant("12-bold", "14-bold", "16-bold");
	const bold16 = getVariant("14-bold", "16-bold", "18-bold");
	const bold18 = getVariant("16-bold", "18-bold", "20-bold");
	const bold20 = getVariant("18-bold", "20-bold", "23-bold");
	const bold23 = getVariant("20-bold", "23-bold", "23-bold");
	const bold24 = getVariant("18-bold", "23-bold", "24-bold");
	const bold28 = getVariant("24-bold", "24-bold", "28-bold");
	const bold36 = getVariant("28-bold", "28-bold", "36-bold");

	const medium11 = getVariant("11-medium", "12-medium", "14-medium");
	const medium14 = getVariant("12-medium", "14-medium", "16-medium");
	const medium16 = getVariant("14-medium", "16-medium", "18-medium");
	const medium18 = getVariant("16-medium", "18-medium", "20-medium");
	const medium20 = getVariant("18-medium", "20-medium", "23-medium");
	const medium23 = getVariant("20-medium", "23-medium", "23-medium");
	const medium24 = getVariant("18-medium", "23-medium", "24-medium");

	const regular12 = getVariant("12-regular", "12-regular", "12-regular");
	const regular14 = getVariant("12-regular", "14-regular", "14-regular");
	const regular16 = getVariant("14-regular", "16-regular", "16-regular");
	const regular18 = getVariant("16-regular", "18-regular", "18-regular");
	const regular20 = getVariant("18-regular", "20-regular", "20-regular");
	const regular23 = getVariant("20-regular", "23-regular", "23-regular");

	return {
		bold11,
		bold14,
		bold16,
		bold18,
		bold20,
		bold23,
		bold24,
		bold28,
		bold36,
		medium11,
		medium14,
		medium16,
		medium18,
		medium20,
		medium23,
		medium24,
		regular12,
		regular14,
		regular16,
		regular18,
		regular20,
		regular23,
	};
}
