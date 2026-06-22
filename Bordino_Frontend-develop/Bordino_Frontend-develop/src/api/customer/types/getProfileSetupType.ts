import type { ResponseApiData } from "@/libs/http/interfaces";

interface ProfileSetupResponse {
	birthdate: string;
	username: string;
	gender: string;
}

export type ProfileSetupApiResponse = ResponseApiData<ProfileSetupResponse>;
