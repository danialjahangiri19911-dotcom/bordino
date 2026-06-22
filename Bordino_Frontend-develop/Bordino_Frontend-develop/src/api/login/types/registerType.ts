import type { ResponseApiData } from "@/libs/http/interfaces";

export enum RegistrationType {
	isRegisteredBefore = 0,
	isNewUser = 1,
}

interface RegisterResponse {
	status: RegistrationType;
	message: string;
	next_step_url: string;
}

export type RegisterApiDataResponse = ResponseApiData<RegisterResponse>;
