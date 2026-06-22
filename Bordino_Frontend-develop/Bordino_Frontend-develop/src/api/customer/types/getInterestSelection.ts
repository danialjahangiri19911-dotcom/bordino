import type { ResponseApiData } from "@/libs/http/interfaces";

interface InterestSectionResponse {
	favorite_categories: string[];
	registration_step: string;
}

export type InterestSectionApiResponse =
	ResponseApiData<InterestSectionResponse>;
