export interface BankAccountBank {
	id: string;
	name: string;
	code: string;
	icon: string;
	is_active: boolean;
}

export interface BankAccount {
	id: string;
	iban: string;
	bank: BankAccountBank;
	account_holder: string;
	status: "approved" | "invalid" | "pending" | "valid";
	create_time: string;
}

export interface BankAccountsApiResponse {
	is_successful: boolean;
	status_code: number;
	result: {
		count: number;
		page_size: number;
		total_pages: number;
		current_page: number;
		next: string | null;
		previous: string | null;
		results: BankAccount[];
	};
	errors: null;
}
