import type { ResponseApiData } from "@/libs/http/interfaces";

interface CurrencyWalletAccount {
	id: string;
	name: string;
	preset_wallet: string;
	wallet: string;
	primary: boolean;
	balance: string;
	status: "valid" | "invalid" | "pending";
}

interface TokenWalletAccount {
	id: string;
	name: string;
	token: string;
	preset_wallet: string;
	status: "valid" | "invalid" | "pending";
	amount: string;
	total_tickets: number;
}

interface WalletResponse {
	id: string;
	owner: string;
	wallet_type: "customer" | "merchant";
	split_balance: string;
	currency_wallet_accounts: CurrencyWalletAccount[];
	token_wallet_accounts: TokenWalletAccount[];
}

export type WalletsApiResponse = ResponseApiData<WalletResponse>;
