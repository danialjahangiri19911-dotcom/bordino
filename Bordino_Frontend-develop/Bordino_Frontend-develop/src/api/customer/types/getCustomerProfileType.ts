import type { ResponseApiData } from "@/libs/http/interfaces";

export const RegistrationStepEnum = {
	ProfileSetup: 1,
	DailyUsageTime: 2,
	UsageGoal: 3,
	InterestSelection: 4,
};

export type RegistrationStepName = keyof typeof RegistrationStepEnum;

interface CustomerProfileResponse {
	id: string;
	username: string;
	gender: "F" | "M";
	birthdate: string;
	registration_step: string;
	consecutive_active_days: number;
	max_consecutive_days: number;
	last_active_date: string | null;
	daily_usage_minutes: number | null;
	signup_reasons: string[];
	favorite_categories: string[];
	phone_number: string;
	image_url: string;
}

export type CustomerProfileApiData = ResponseApiData<CustomerProfileResponse>;
