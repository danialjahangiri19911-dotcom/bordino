import type { ResponseApiData } from "@/libs/http/interfaces";

export interface CurrencySummaryResponse {
	currency_wallet_accounts: Array<CurrecncyWalletSchema>;
}

export interface CurrecncyWalletSchema {
	id: string;
	name: string;
	preset_wallet: string;
	wallet_type: "customer";
	primary: true;
	balance: string;
	status: string;
	expire_date: string;
	iban?: string;
	bank_logo?: string;
}

export type CurrencySummaryApiResponse =
	ResponseApiData<CurrencySummaryResponse>;
