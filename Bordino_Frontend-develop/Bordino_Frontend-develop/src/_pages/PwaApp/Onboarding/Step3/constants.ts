import {
	BIG_LOTTERY_PARTICIPATION,
	DISCOUNTS_AND_BENEFITS,
	EDUCATIONAL_CONTENT,
	GAMES_AND_ENTERTAINMENT,
	OTHER_REASONS,
	SKILL_DEVELOPMENT,
} from "@/constants/imagePaths";

export const STEP3_OPTIONS = [
	{
		label: "برنده شدن در قرعه‌کشی های بزرگ",
		value: "BigLotteryParticipation",
		icon: BIG_LOTTERY_PARTICIPATION,
	},
	{
		label: "بازی و سرگرمی",
		value: "GamesAndEntertainment",
		icon: GAMES_AND_ENTERTAINMENT,
	},
	{
		label: "کسب تخفیفات و مزیای خرید",
		value: "DiscountsAndBenefits",
		icon: DISCOUNTS_AND_BENEFITS,
	},
	{
		label: "یادگیری و توسعه مهارت‌ها",
		value: "SkillDevelopment",
		icon: SKILL_DEVELOPMENT,
	},
	{
		label: "استفاده از محتوای آموزشی یا مفید",
		value: "EducationalContent",
		icon: EDUCATIONAL_CONTENT,
	},
	{ label: "دلایل دیگر", value: "OtherReasons", icon: OTHER_REASONS },
];
