import type { ResponseApiData } from "@/libs/http/interfaces";

interface DailyUsageTimeResponse {
	daily_usage_minutes: string;
	registration_step: string;
}

export type DailyUsageTimeApiResponse = ResponseApiData<DailyUsageTimeResponse>;
