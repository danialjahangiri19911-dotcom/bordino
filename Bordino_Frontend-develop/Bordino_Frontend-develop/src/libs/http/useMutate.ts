import type { FieldValues, SubmitHandler } from "react-hook-form";

import { withAuth } from "./query";
import type { RequestError } from "./requester";
import requester from "./requester";
import type { MutationFunction } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

interface UseMutateProps<Data, Variables> {
	url: string;
	method?: HttpMethod;
	onSuccess?: (data: Data, variables: Variables | undefined) => void;
	onError?: (error: RequestError) => void;
	mutationFn?: MutationFunction<Data, Variables | undefined>;
	hasHeader?: boolean;
}

// Data is the response of the request and Variables is the data you want to send
export default function useMutate<Data, Variables>({
	url,
	method = "POST",
	mutationFn,
	onSuccess,
	onError,
	hasHeader = true,
}: UseMutateProps<Data, Variables>) {
	const {
		mutate,
		isPending: isSending,
		data: response,
	} = useMutation<Data, RequestError, Variables | undefined>({
		mutationFn:
			mutationFn ??
			(async (payload: Variables | undefined) => {
				const send = async (accessToken: string | null) => {
					const config = hasHeader
						? {
								headers: {
									Authorization: `Bearer ${accessToken}`,
								},
							}
						: {};

					switch (method) {
						case "POST":
							return (await requester.post<Data>(url, payload, config)).data;
						case "PUT":
							return (await requester.put<Data>(url, payload, config)).data;
						case "PATCH":
							return (await requester.patch<Data>(url, payload, config)).data;
						case "DELETE":
							return (
								await requester.delete<Data>(url, {
									...config,
									data: payload,
								})
							).data;
						default:
							throw new Error(`Unsupported HTTP method: ${method}`);
					}
				};
				// Authenticated mutations refresh an expired access token like queries do.
				return hasHeader ? withAuth(send) : send(null);
			}),

		onSuccess: (data, variables) => {
			if (onSuccess) onSuccess(data, variables);
		},

		onError: (error) => {
			if (onError) onError(error);
		},
	});

	const submitHandler: SubmitHandler<
		Variables extends FieldValues ? Variables : FieldValues
	> = (formData) => {
		mutate(formData as Variables);
	};

	const mutateWithoutPayload = () => {
		mutate(undefined as Variables);
	};

	return {
		submitHandler,
		isSending,
		response,
		mutateWithoutPayload,
	};
}
