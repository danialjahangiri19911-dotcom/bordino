import {
	APP_HOME,
	GAME_NET,
	MAIN_APP,
	ONBOARDING,
	OTP,
	PROFILE,
	REGISTER, // SHOP,
	WALLET,
} from "@/constants/routes";

export const PWA_BOTTOM_NAVIGATION = [MAIN_APP, WALLET, PROFILE];

export const EXCLUDE_PATHS = [
	APP_HOME.path,
	REGISTER.path,
	OTP.path,
	ONBOARDING.path,
	"/pwa/lottery/buy-ticket",
	GAME_NET.path,
	// BUY_TICKET.path,
];
