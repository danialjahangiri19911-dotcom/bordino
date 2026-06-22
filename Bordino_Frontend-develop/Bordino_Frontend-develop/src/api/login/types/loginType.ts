import type { ResponseApiData } from "@/libs/http/interfaces";

type LoginResponse = {
	tokens: { access_token: string; refresh_token: string };
};

export type LoginApiDataResponse = ResponseApiData<LoginResponse>;
