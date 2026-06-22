import type { DailyTasksProps } from "@/libs/components/cards/main/DailyTaskCard";

const DAILY_TASKS_BASE_MEDIA_PATH = "/media/App/main/dailyTasks";

export const DAILY_TASKS_MOCK_DATA: DailyTasksProps[] = [
	{
		image: `${DAILY_TASKS_BASE_MEDIA_PATH}/1.svg`,
		title: "حل کردن یک کوییز",
		score: 45,
		status: "done",
	},
	{
		image: `${DAILY_TASKS_BASE_MEDIA_PATH}/2.svg`,
		title: "تماشای 3 ویدیوی تبلیغاتی (0/3)",
		score: 55,
		status: "notDone",
	},
	{
		image: `${DAILY_TASKS_BASE_MEDIA_PATH}/3.svg`,
		title: "تکمیل اطلاعات حساب کاربری",
		score: 55,
		status: "done",
	},
];

export const SPECIAL_CHALLENGE: DailyTasksProps[] = [
	{
		image: `/media/App/main/specialChallenge/1.svg`,
		title: "تکمیل پرسشنامه وبسایت همراه اول",
		score: 170,
		status: "notDone",
	},
];
