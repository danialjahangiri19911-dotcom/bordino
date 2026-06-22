import type { ResponseApiData } from "@/libs/http/interfaces";

export interface CreateBankAccountRequest {
	iban: string;
	bank: string;
	account_holder: string;
}

export interface CreateBankAccountResponse {
	id: string;
	iban: string;
	bank: string;
	account_holder: string;
	status: string;
}

export type CreateBankAccountApiResponse =
	ResponseApiData<CreateBankAccountResponse>;
