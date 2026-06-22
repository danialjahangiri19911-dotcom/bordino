import { useCallback } from "react";

import { useQueryClient } from "@tanstack/react-query";

interface Props {
	handleNext?: () => void;
}
export default function useGeneralStepOnSuccess({ handleNext }: Props = {}) {
	const queryClient = useQueryClient();

	const onSuccess = useCallback(() => {
		queryClient.invalidateQueries();
		handleNext?.();
	}, [handleNext, queryClient]);

	return { onSuccess };
}
