export const AUTH_URLS = {
	LOGIN: "login/",
	REGISTER: "registration/",
	RESEND_OTP: "resend_otp/",
	REFRESH_TOKEN: "/token/refresh/",
};

export const CUSTOMER_URLS = {
	PROFILE: "customer/profile/me",
	CUSTOMER_REGISTER: "customer/step/profile-setup/",
	PROFILE_SETUP: "customer/step/profile-setup/me/",
	DAILY_USAGE_TIME: "customer/step/daily-usage-time/me/",
	USAGE_GOAL: "customer/step/usage-goal/me/",
	INTEREST_SELECTION: "customer/step/interest-selection/me/",
	PROFILE_IMAGE: "customer/profile-image/me/",
};

export const WALLET = {
	GET_WALLETS_LIST: "wallet/customer/:id/",
	GET_TRANSACTIONS_LIST: "wallet/transactions/ticket/",
	GET_POINTS_SUMMARY: "wallet/points/summary/",
	GET_CURRENCY_SUMMARY: "wallet/currency/summary/",
	GET_POINTS_TRANSACTIONS: "wallet/points/transactions/",
	GET_CURRENCY_TRANSACTIONS: "wallet/currency/transactions/",
	GET_BANKS: "wallet/banks/",
	GET_BANK_ACCOUNTS: "wallet/bank-accounts/",
	CREATE_BANK_ACCOUNT: "wallet/bank-accounts/",
	WITHDRAW_CURRENCY: "wallet/currency/withdraw/",
	GAME_PLAY_COST: "wallet/games/charge/",
	GAME_PLAY_CHARGE: "wallet/games/charge/",
};

export const LOTTERY = {
	GET_LOTTERY_LIST: "lotteries/",
	GET_LOTTERY_DETAIL: "lotteries/:id/",
	GET_LOTTERY_TICKETS: "lotteries/:id/tickets/me/",
	BUY_TICKET: "lotteries/ticket/",
	GET_TICKET_DETAIL: "lotteries/ticket/:id/",
	GET_LOTTERY_FULL_DETAIL: "lotteries/:id/results/",
	GET_LOTTERY_WINNER: "lotteries/:id/results/winners/:winnerId/",
	BUY_TICKET_NUMBERS: "lotteries/ticket/numbers/",
};

export const LOTTERY_WHEEL = {
	GET_WHEEL: "lotteries/lottery-wheel/:id/",
	SPIN: "lotteries/lottery-wheel/spin/",
};

export const GAME_URLS = {
	CONFIG: "game/configuration/get_configuration/",
};

export const ACTIVITY_URLS = {
	RECORD_ACTION: "activity/record-action/",
};

export const ENTERTAINMENT_URLS = {
	RANDOM_FORTUNE: "entertainment/fortune-reading/",
};
