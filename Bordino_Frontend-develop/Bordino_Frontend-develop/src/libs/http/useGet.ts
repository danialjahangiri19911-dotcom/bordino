import { useCallback } from "react";

import requester, { isRequestError } from "./requester";
import type { RequestError } from "@libs/http/requester";

type OnSuccess<D> = (data: D) => void;
type OnError = (error: RequestError) => void;

interface Options<D> {
	onSuccess?: OnSuccess<D>;
	onError?: OnError;
}

export default function useGet<D>(options: Options<D> = {}) {
	const { onSuccess: generalOnSuccess, onError: generalOnError } = options;

	const get = useCallback(
		(url: string, getOptions: Options<D> = {}) => {
			const { onSuccess, onError } = getOptions;
			(async () => {
				try {
					const { data } = await requester.get(url);
					if (generalOnSuccess) generalOnSuccess(data);
					if (onSuccess) onSuccess(data);
					return data;
				} catch (e) {
					if (isRequestError(e)) {
						if (generalOnError) generalOnError(e);
						if (onError) onError(e);
					} else {
						throw e;
					}
				}
			})();
		},
		[generalOnSuccess, generalOnError],
	);

	return { get };
}
