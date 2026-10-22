export interface WithdrawCurrencyRequest {
	amount: number;
	bank_account_id: string;
	/** Same id on a retry = the same withdrawal (the server does not create a second one). */
	request_id?: string;
}

export interface WithdrawCurrencyResponse {
	// Add response fields when API response structure is known
	[key: string]: unknown;
}

export interface WithdrawCurrencyApiResponse {
	is_successful: boolean;
	status_code: number;
	result: WithdrawCurrencyResponse;
	errors: null | string[];
}
