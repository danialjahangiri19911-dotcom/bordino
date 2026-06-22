import type { ResponseApiData } from "@/libs/http/interfaces";

interface UsageGoalResponse {
	signup_reasons: string[];
}

export type UsageGoaApiResponse = ResponseApiData<UsageGoalResponse>;
