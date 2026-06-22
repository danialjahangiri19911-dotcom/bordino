import { useTheme } from "@libs/styles/styled";

import {
	ARTS_AND_CULTURE,
	ECONOMY,
	EDUCATION,
	ENTERTAINMENT,
	HEALTH,
	NEWS_AND_EVENTS,
	SPORTS,
	TECHNOLOGY,
	TRAVEL_AND_TOURISM,
} from "@/constants/imagePaths";

export default function useStep4() {
	const theme = useTheme();
	const STEP4_OPTIONS = [
		{ value: "Sports", icon: SPORTS, color: theme.palette.secondary.main },
		{
			value: "NewsAndEvents",
			icon: NEWS_AND_EVENTS,
			color: theme.palette.error.dark,
		},
		{
			value: "Technology",
			icon: TECHNOLOGY,
			color: theme.palette.success.main,
		},
		{
			value: "TravelAndTourism",
			icon: TRAVEL_AND_TOURISM,
			color: theme.palette.primary[900],
		},
		{
			value: "ArtsAndCulture",
			icon: ARTS_AND_CULTURE,
			color: theme.palette.error.dark,
		},
		{ value: "Economy", icon: ECONOMY, color: theme.palette.secondary.main },
		{ value: "Health", icon: HEALTH, color: theme.palette.success.main },
		{
			value: "Education",
			icon: EDUCATION,
			color: theme.palette.secondary[300],
		},
		{
			value: "Entertainment",
			icon: ENTERTAINMENT,
			color: theme.palette.error.dark,
		},
	];

	return { STEP4_OPTIONS };
}
