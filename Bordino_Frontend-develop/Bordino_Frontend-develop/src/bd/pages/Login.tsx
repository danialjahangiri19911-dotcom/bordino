"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { normalizePhone } from "../format";
import { useArt } from "../appearance";
import { AuthShell, R } from "../ui";

import { authErrorMessage } from "@/api/login/errorMessage";
import useResendOtp from "@/api/login/hooks/useResendOtp";
import type { RegisterApiDataResponse } from "@/api/login/types/registerType";
import { RegistrationType } from "@/api/login/types/registerType";
import { AUTH_URLS } from "@/api/urls";
import useMutate from "@/libs/http/useMutate";
import useAuthStore from "@/libs/stores/authStore";
import { useRegisterPhoneNumberStore } from "@/libs/stores/useUerRegisterPhoneNumber";

export default function Login() {
	const discover = useArt("discover");
	const { push, replace } = useRouter();
	const { isLoggedIn, setAlreadyExist } = useAuthStore();
	const { phone_number, setPhoneNumber, markOtpSent } = useRegisterPhoneNumberStore();
	const { resendOtp } = useResendOtp();
	const [text, setText] = useState(phone_number ? `0${phone_number}` : "");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isLoggedIn) replace(R.home);
	}, [isLoggedIn, replace]);

	const { submitHandler, isSending } = useMutate<RegisterApiDataResponse, { phone_number: string }>({
		url: AUTH_URLS.REGISTER,
		hasHeader: false,
		onSuccess: (data, variables) => {
			const phone = variables?.phone_number ?? "";
			setPhoneNumber(phone);
			if (data.result.status === RegistrationType.isRegisteredBefore) {
				setAlreadyExist(true);
				// Known number: registration sends no code, so ask for one. If the last code is still
				// valid the server refuses with «wait», and the code page keeps counting down.
				push(R.otp);
				resendOtp(phone, { onSuccess: () => markOtpSent(phone) });
			} else {
				setAlreadyExist(false);
				markOtpSent(phone);
				push(R.otp);
			}
		},
		onError: (e) => setError(authErrorMessage(e)),
	});

	return (
		<AuthShell title="ورود">
			<div className="au-login au-layout-1">
				<section className="au-welcome">
					<span className="au-eyebrow">BORDINO / WELCOME</span>
					<h2>
						وقتِ یک
						<br />
						<span className="bd-em">حال‌وهوای تازه‌ست.</span>
					</h2>
					<p>بازی‌ها، سرگرمی‌ها و فضای شخصی‌ات، همه یک‌جا.</p>
					<div className="au-image-art" aria-hidden="true">
						<img src={discover.src} srcSet={discover.srcSet} sizes="(max-width: 540px) 80vw, 420px" alt="" width={1280} height={1280} decoding="async" />
					</div>
					<div className="au-benefits">
						<span>
							<Icon name="gamepad-2" />
							بازی‌های متنوع
						</span>
						<span>
							<Icon name="wallet" />
							کیف‌پول یکپارچه
						</span>
					</div>
				</section>
				<section className="au-form-panel">
					<span className="au-entry-icon">
						<Icon name="smartphone" />
					</span>
					<span className="au-eyebrow">شروع از همین‌جا</span>
					<h2>ورود به بردینو</h2>
					<p className="au-form-description">شماره موبایلت را وارد کن تا کد ورود برایت ارسال شود.</p>
					<form
						noValidate
						onSubmit={(event) => {
							event.preventDefault();
							const phone = normalizePhone(text);
							if (!text.trim()) return setError("شمارهٔ موبایل را وارد کن.");
							if (!phone) return setError("شمارهٔ موبایل معتبر نیست؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.");
							setError(null);
							submitHandler({ phone_number: phone });
						}}
					>
						<label className="au-phone-label" htmlFor="login-phone">
							شماره موبایل
						</label>
						<div className="au-phone-box" dir="ltr">
							<span>+98</span>
							<input
								id="login-phone"
								type="tel"
								name="phone"
								inputMode="tel"
								autoComplete="tel-national"
								placeholder="912 345 6789"
								maxLength={18}
								value={text}
								aria-invalid={!!error}
								aria-describedby="login-phone-help login-phone-error"
								onChange={(event) => {
									setText(event.target.value);
									setError(null);
								}}
							/>
						</div>
						<small id="login-phone-help" className="au-helper">
							شمارهٔ ایران؛ با صفر یا بدون صفر وارد کن.
						</small>
						<p id="login-phone-error" className="au-error" role="alert">
							{error}
						</p>
						<button className="bd-action au-submit" type="submit" disabled={isSending}>
							{isSending ? "در حال ارسال…" : "دریافت کد ورود"} <Icon name="arrow-left" />
						</button>
					</form>
					<p className="au-terms">
						ادامه دادن به معنی پذیرش{" "}
						<Link className="bd-text-btn" href={R.rules}>
							شرایط استفاده
						</Link>{" "}
						است.
					</p>
					<div className="au-security">
						<Icon name="shield-check" />
						<span>ورود با کد یک‌بارمصرف</span>
					</div>
				</section>
			</div>
		</AuthShell>
	);
}
