"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { fa } from "../format";
import { AuthShell, R } from "../ui";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import { authErrorMessage } from "@/api/login/errorMessage";
import useResendOtp from "@/api/login/hooks/useResendOtp";
import type { LoginApiDataResponse } from "@/api/login/types/loginType";
import { AUTH_URLS } from "@/api/urls";
import useMutate from "@/libs/http/useMutate";
import useAuthStore from "@/libs/stores/authStore";
import { useRegisterPhoneNumberStore } from "@/libs/stores/useUerRegisterPhoneNumber";
import useUserStore from "@/libs/stores/userStore";
import useCounter from "@/libs/uiHooks/useCounter";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

/** The server's OTP_LENGTH (main_app/settings.py, default 4; prod does not override it). */
const OTP_LENGTH = 4;

export default function Otp() {
	const { push, replace } = useRouter();
	const { phone_number, markOtpSent, getOtpRemaining } = useRegisterPhoneNumberStore();
	const { login, userAlreadyExist, isLoggedIn } = useAuthStore();
	const { setUser } = useUserStore();
	const { resendOtp } = useResendOtp();
	const { counter, resetCounter, startFrom } = useCounter();
	const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
	const [referral, setReferral] = useState("");
	const [showReferral, setShowReferral] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const boxes = useRef<(HTMLInputElement | null)[]>([]);
	const code = digits.join("");

	useEffect(() => {
		if (!phone_number) replace(R.login);
		else startFrom(getOtpRemaining(phone_number));
	}, [phone_number, replace, startFrom, getOtpRemaining]);

	// Signed in: where to go depends on the profile (a new player completes it first).
	const { data: profile } = useGetCustomerProfile();
	useEffect(() => {
		const p = profile?.result;
		if (!p || !isLoggedIn) return;
		setUser({
			id: p.id,
			username: p.username ?? "",
			gender: p.gender,
			birthdate: p.birthdate ?? "",
			phoneNumber: p.phone_number ?? "",
			image_url: p.image_url ?? "",
			registrationStep: p.registration_step ?? "",
		});
		replace(p.registration_step === "ProfileSetup" ? R.onboarding : R.home);
	}, [profile?.result, isLoggedIn, replace, setUser]);

	const { submitHandler, isSending } = useMutate<LoginApiDataResponse, { phone_number: string; otp: string; referral_code?: string }>({
		url: AUTH_URLS.LOGIN,
		hasHeader: false,
		onSuccess: (data) => {
			const tokens = data?.result?.tokens;
			if (tokens) login(tokens.access_token, tokens.refresh_token);
		},
		onError: (e) => {
			setError(authErrorMessage(e));
			setDigits(Array(OTP_LENGTH).fill(""));
			boxes.current[0]?.focus();
		},
	});

	const submit = (value: string) => {
		if (value.length !== OTP_LENGTH || isSending || !phone_number) return;
		setError(null);
		submitHandler({
			phone_number,
			otp: value,
			...(!userAlreadyExist && referral.trim() ? { referral_code: referral.trim() } : {}),
		});
	};

	const fill = (from: number, text: string) => {
		const incoming = persianNumberConverter(text).replace(/\D/g, "").split("");
		if (!incoming.length) return;
		const next = [...digits];
		let at = from;
		for (const d of incoming) {
			if (at >= OTP_LENGTH) break;
			next[at] = d;
			at += 1;
		}
		setDigits(next);
		setError(null);
		boxes.current[Math.min(at, OTP_LENGTH - 1)]?.focus();
		// The whole code arrived (typed, pasted or offered by the phone from the SMS): send it.
		if (next.every(Boolean) && !showReferral) submit(next.join(""));
	};

	return (
		<AuthShell title="تأیید کد ورود">
			<div className="rt-auth">
				<span className="rt-auth-symbol">
					<Icon name="message-square-lock" />
				</span>
				<h2>کد ورود را وارد کن</h2>
				<p>
					کد {fa(OTP_LENGTH)}رقمی پیامک‌شده به <bdi dir="ltr">0{phone_number}</bdi> را وارد کن.
				</p>
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						submit(code);
					}}
				>
					<div className="rt-otp" dir="ltr" role="group" aria-label="کد ورود">
						{digits.map((digit, index) => (
							<input
								key={index}
								ref={(el) => {
									boxes.current[index] = el;
								}}
								value={digit}
								inputMode="numeric"
								autoComplete={index === 0 ? "one-time-code" : "off"}
								maxLength={index === 0 ? OTP_LENGTH : 1}
								aria-label={`رقم ${fa(index + 1)} از ${fa(OTP_LENGTH)}`}
								autoFocus={index === 0}
								disabled={isSending}
								onChange={(event) => {
									const value = event.target.value;
									if (!value) {
										const next = [...digits];
										next[index] = "";
										setDigits(next);
										return;
									}
									fill(index, value.slice(-OTP_LENGTH));
								}}
								onKeyDown={(event) => {
									if (event.key === "Backspace" && !digit && index > 0) boxes.current[index - 1]?.focus();
								}}
								onPaste={(event) => {
									event.preventDefault();
									fill(0, event.clipboardData.getData("text/plain"));
								}}
							/>
						))}
					</div>
					{error ? (
						<p className="au-error" role="alert">
							{error}
						</p>
					) : null}
					{info ? <p role="status">{info}</p> : null}
					{!userAlreadyExist ? (
						showReferral ? (
							<label className="rt-field">
								<span>کد معرف (اختیاری)</span>
								<input type="text" dir="ltr" value={referral} onChange={(event) => setReferral(event.target.value)} />
							</label>
						) : (
							<button type="button" className="bd-text-btn" onClick={() => setShowReferral(true)}>
								کد معرف داری؟
							</button>
						)
					) : null}
					<button type="submit" className="bd-action" disabled={code.length !== OTP_LENGTH || isSending}>
						{isSending ? "در حال بررسی…" : "تأیید و ادامه"}
					</button>
				</form>
				<button type="button" className="bd-text-btn" onClick={() => push(R.login)}>
					ویرایش شمارهٔ همراه
				</button>
				{counter > 0 ? (
					<p className="bd-muted" aria-live="polite">
						ارسال دوباره تا {fa(counter)} ثانیهٔ دیگر
					</p>
				) : (
					<button
						type="button"
						className="bd-text-btn"
						onClick={() =>
							resendOtp(phone_number, {
								onSuccess: () => {
									markOtpSent(phone_number);
									resetCounter();
									setDigits(Array(OTP_LENGTH).fill(""));
									setError(null);
									setInfo("کد تازه فرستاده شد.");
								},
								onError: (e) => setError(authErrorMessage(e)),
							})
						}
					>
						ارسال مجدد کد
					</button>
				)}
			</div>
		</AuthShell>
	);
}
