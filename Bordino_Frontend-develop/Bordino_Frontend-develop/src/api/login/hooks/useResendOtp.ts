import { useCallback } from "react";

import { useRouter } from "next/navigation";

import type { RequestError } from "@libs/http/requester";
import requester from "@libs/http/requester";

import { AUTH_URLS } from "@/api/urls";
import { OTP } from "@/constants/routes";

interface ResendOtpOptions {
	onSuccess?: (response: any) => void;
	onError?: (error: RequestError) => void;
	onFinally?: () => void;
}

export default function useResendOtp() {
	const { push } = useRouter();

	const resendOtp = useCallback(
		async (
			phoneNumber: string,
			{ onSuccess, onError, onFinally }: ResendOtpOptions = {},
		) => {
			try {
				const response = await requester.post(AUTH_URLS.RESEND_OTP, {
					phone_number: phoneNumber,
				});
				if (response.status === 201) {
					push(OTP.path);
					if (onSuccess) {
						onSuccess(response);
					}
				}
			} catch (error) {
				if (onError) {
					onError(error as RequestError);
				}
			} finally {
				if (onFinally) {
					onFinally();
				}
			}
		},
		[push],
	);

	return { resendOtp };
}
