import { WALLET } from "@/api/urls";
import type { PointsSummaryApiResponse } from "@/api/wallet/types/getPointsSummaryType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetPointsSummary(
	props: ExtendableOptions<PointsSummaryApiResponse> = {},
) {
	const { data, isLoading, error, refetch } =
		useQuery<PointsSummaryApiResponse>({
			url: WALLET.GET_POINTS_SUMMARY,
			headers: true,
			...props,
		});
	return { data, isLoading, error, refetch };
}
