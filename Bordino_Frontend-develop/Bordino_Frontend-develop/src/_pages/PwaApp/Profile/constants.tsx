import MoonIcon from "@/libs/components/icons/components/Moon";
import NotificationIcon from "@/libs/components/icons/components/Notification";
import ProfileIcon from "@/libs/components/icons/components/Profile";
import ShieldIcon from "@/libs/components/icons/components/Shield";
import signOut from "@/libs/http/signOut";

export const ACCOUNT_SETTINGS_ITEMS = [
	{ icon: <ProfileIcon />, title: "اطلاعات شخصی" },
	{ icon: <ShieldIcon />, title: "رمز و امنیت" },
	{
		icon: "x",
		title: "خروج",
		handleGoTask: signOut,
	},
];

export const APP_SETTINGS_ITEMS = [
	{ icon: <NotificationIcon />, title: "مدیریت اعلانات" },
	{
		icon: <MoonIcon />,
		title: "حالت تیره",
	},
];

export const SCORES_GIFT_ITEMS = [
	{ icon: <NotificationIcon />, title: "تاریخچه جوایز" },
	{
		icon: <MoonIcon />,
		title: "دستاورد‌ها",
	},
];
