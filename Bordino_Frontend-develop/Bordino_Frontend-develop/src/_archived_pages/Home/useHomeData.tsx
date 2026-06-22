import { type ReactNode, useCallback } from "react";

import { useRouter } from "next/navigation";

import Typography, {
	type TypographyProps,
} from "@libs/components/atoms/Typography";

import {
	DAILY_TASKS,
	HOME_PAGE_IMAGE,
	MONTHLY_BORDINO,
	PLAY_WIN_MONEY,
} from "@/constants/imagePaths";
import { APP_HOME } from "@/constants/routes";
import Button from "@/libs/components/atoms/Button";
import useVariants from "@/libs/uiHooks/useVariants";

interface HomeData {
	src: string;
	title: string;
	titleProps?: TypographyProps;
	content: ReactNode;
}
export default function useHomeData() {
	const { push } = useRouter();

	const redirectToApp = useCallback(() => {
		push(APP_HOME.path);
	}, [push]);

	const { bold36, bold28, medium24 } = useVariants();

	const homeData: HomeData[] = [
		{
			src: HOME_PAGE_IMAGE,
			title:
				"متن نمونه، مثال، معرفی و نمایش برای قرار دادن درقسمت هیرو پیج لندینگ",
			content: (
				<Button
					sx={{ width: { lg: "85%", md: "auto" } }}
					onClick={redirectToApp}
				>
					همین الان شروع کنید
				</Button>
			),
			titleProps: {
				variant: bold28,
				width: "90%",
				textAlign: "center",
			},
		},
		{
			src: PLAY_WIN_MONEY,
			title: "در قرعه‌کشی های ما، همه برنده اند !",
			content: (
				<Typography variant={medium24}>
					در قرعه‌کشی‌های ما، شانس برنده شدن به شما نزدیک‌تر از همیشه است! کافی
					است یکی از شش توپ را به درستی از میان اعداد 1 تا 99 انتخاب کنید تا
					جایزه شما تضمین شود.
				</Typography>
			),
			titleProps: {
				variant: bold36,
				width: "100%",
				textAlign: { lg: "start", md: "center" },
				color: "primary",
			},
		},
		{
			src: MONTHLY_BORDINO,
			title: "بازی کنید و برنده شوید و جایزه ببرید !",
			content: (
				<Typography variant={medium24}>
					با بازی‌های ساده و سرگرم‌کننده مثل پازل و سودوکو هم لذت ببرید و هم
					امتیاز جمع کنید! این امتیازها را می‌توانید به جوایز هیجان‌انگیز تبدیل
					کنید.
				</Typography>
			),
			titleProps: {
				variant: bold36,
				width: "100%",
				textAlign: { lg: "start", md: "center" },
				color: "primary",
			},
		},
		{
			src: DAILY_TASKS,
			title: "هر روز چالش هارو انجام بده و امتیاز بگیر",
			content: (
				<Typography variant={medium24}>
					هر روز با چالش‌های جذاب مثل انجام یک بازی خاص یا تماشای ویدیوی کوتاه،
					امتیاز جمع کنید. این چالش‌ها ساده و سرگرم‌کننده هستند و راهی آسان برای
					کسب جوایز جذاب در اختیار شما می‌گذارند!
				</Typography>
			),
			titleProps: {
				variant: bold36,
				width: "100%",
				textAlign: { lg: "start", md: "center" },
				color: "primary",
			},
		},
	];

	return { homeData };
}
