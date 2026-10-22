import GameIcon from "@/libs/components/icons/components/Game";
import HomeIcon from "@/libs/components/icons/components/Home";
import ProfileIcon from "@/libs/components/icons/components/Profile";
import ShopIcon from "@/libs/components/icons/components/Shop";
import WalletIcon from "@/libs/components/icons/components/Wallet";

export const APP_HOME = {
	path: "/pwa",
	icon: "",
};

export const REGISTER = {
	path: `${APP_HOME.path}/register`,
	icon: "",
};

export const RULES = {
	path: `${APP_HOME.path}/rules`,
	icon: "",
};

export const OTP = {
	path: `${APP_HOME.path}/otp`,
	icon: "",
};

export const ONBOARDING = {
	path: `${APP_HOME.path}/onboarding`,
	icon: "",
};

export const MAIN_APP = {
	title: "خانه",
	path: `${APP_HOME.path}/main`,
	icon: <HomeIcon />,
};

export const GAME_NET = {
	title: "گیمنت",
	path: `${APP_HOME.path}/gameNet`,
	icon: <GameIcon />,
};

export const WHEEL = {
	title: "چرخونه شانسی",
	path: `${APP_HOME.path}/wheel`,
	icon: "",
};

export const SHOP = {
	title: "فروشگاه",
	path: `${APP_HOME.path}/shop`,
	icon: <ShopIcon />,
};

export const WALLET = {
	title: "کیف‌پول",
	path: `${APP_HOME.path}/wallet`,
	icon: <WalletIcon />,
};

export const PROFILE = {
	title: "پروفایل",
	path: `${APP_HOME.path}/profile`,
	icon: <ProfileIcon />,
};

export const LOTTERY = {
	title: "قرعه کشی",
	path: `${APP_HOME.path}/lottery`,
	icon: "",
};

export const BUY_TICKET = {
	title: "خرید بلیط",
	path: `${LOTTERY.path}/buy-ticket`,
	icon: "",
};

export const TICKET_DETAIL = {
	title: "جزئیات بلیط",
	path: `${LOTTERY.path}/ticket-detail/:id`,
	icon: "",
};

export const LOTTERY_DETAIL = {
	title: "جزئیات قرعه کشی",
	path: `${LOTTERY.path}/lottery-detail/:id`,
	icon: "",
};

export const LOTTERY_GUIDE = {
	title: "راهنمای کامل قرعه‌کشی",
	path: `${LOTTERY.path}/guide`,
	icon: "",
};

export const HAFEZ = {
	title: "فال حافظ",
	path: `${APP_HOME.path}/hafez`,
	icon: "",
};

export const HAFEZ_RESULT = {
	title: "نتیجه فال حافظ",
	path: `${APP_HOME.path}/hafez/result`,
	icon: "",
};

export const TAROT = {
	title: "فال تاروت",
	path: `${APP_HOME.path}/tarot`,
	icon: "",
};

export const SUDOKU = {
	title: "سودوکو",
	path: `${APP_HOME.path}/sudoku`,
	icon: "",
};

export const CRASH = {
	title: "انفجار",
	path: `${APP_HOME.path}/crash`,
	icon: "",
};

export const CHICKEN = {
	title: "مرغ فراری",
	path: `${APP_HOME.path}/chicken`,
	icon: "",
};

export const GAME_2048 = {
	title: "۲۰۴۸",
	path: `${APP_HOME.path}/2048`,
	icon: "",
};
