import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

import signOut from "@/libs/http/signOut";

// Only what works: the rows that used to sit here (personal information, security, notifications,
// dark mode, prize history, achievements) had no action behind them and are back when they have one.
export const ACCOUNT_SETTINGS_ITEMS = [
	{
		icon: <LogoutRoundedIcon fontSize="small" />,
		title: "خروج از حساب",
		handleGoTask: signOut,
	},
];
