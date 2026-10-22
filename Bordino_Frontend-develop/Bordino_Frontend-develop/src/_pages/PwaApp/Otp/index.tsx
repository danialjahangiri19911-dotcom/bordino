"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OtpInput from "react-otp-input";
import { toast } from "react-toastify";

import { useRouter } from "next/navigation";

import useLoginForm from "./loginForm/useForm";
import type { loginFormValue } from "./loginForm/validations";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Typography from "@libs/components/atoms/Typography";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import { authErrorMessage } from "@/api/login/errorMessage";
import useResendOtp from "@/api/login/hooks/useResendOtp";
import type { LoginApiDataResponse } from "@/api/login/types/loginType";
import { AUTH_URLS } from "@/api/urls";
import { PANDA_AUTH } from "@/constants/imagePaths";
import { MAIN_APP, ONBOARDING, REGISTER } from "@/constants/routes";
import ImageBox from "@/libs/components/ImageBox";
import Modal from "@/libs/components/atoms/Modal";
import Slide from "@/libs/components/atoms/Slide";
import TextField from "@/libs/components/fields/Textfield";
import LoadingButton from "@/libs/components/loading/LoadingButton";
import useMutate from "@/libs/http/useMutate";
import useAuthStore from "@/libs/stores/authStore";
import { useRegisterPhoneNumberStore } from "@/libs/stores/useUerRegisterPhoneNumber";
import useUserStore from "@/libs/stores/userStore";
import useCounter from "@/libs/uiHooks/useCounter";
import useVariants from "@/libs/uiHooks/useVariants";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

export default function SendOtp() {
	const [otp, setOtp] = useState("");
	const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
	// باکس اصلی صفحه؛ مودال کد معرف داخل همین محدود می‌شود تا backdrop کل صفحه را نگیرد.
	const pageContainerRef = useRef<HTMLDivElement>(null);
	const { push } = useRouter();
	const { phone_number, markOtpSent, getOtpRemaining } =
		useRegisterPhoneNumberStore();
	const { bold20, regular16, regular12 } = useVariants();
	const { time, counter, resetCounter, startFrom } = useCounter();
	const { resendOtp } = useResendOtp();
	const { login, userAlreadyExist, isLoggedIn } = useAuthStore();
	const loginForm = useLoginForm();
	const { handleSubmit, setValue } = loginForm;

	const { setUser } = useUserStore();

	const { data } = useGetCustomerProfile();

	useEffect(() => {
		if (!data?.result) return;

		setUser({
			id: data.result.id,
			username: data.result.username ?? "",
			gender: data.result.gender ?? "",
			birthdate: data.result.birthdate ?? "",
			phoneNumber: data.result.phone_number ?? "",
			image_url: data.result.image_url ?? "",
			registrationStep: data.result.registration_step ?? "",
		});

		if (!isLoggedIn) return;

		if (data.result.registration_step === "ProfileSetup") {
			push(ONBOARDING.path);
		} else {
			push(MAIN_APP.path);
		}
	}, [data?.result, isLoggedIn, push, setUser]);

	useEffect(() => {
		if (phone_number) {
			setValue("phone_number", persianNumberConverter(phone_number));
		} else {
			push(REGISTER.path);
		}
	}, [phone_number, push, setValue]);

	// شمارش معکوس را از زمانِ واقعیِ باقی‌مانده‌ی همان شماره شروع کن (نه همیشه ۶۰).
	// اگر کاربر همان شماره را دوباره وارد کرده باشد، ادامه‌ی زمان قبلی نمایش داده می‌شود.
	useEffect(() => {
		if (!phone_number) return;
		startFrom(getOtpRemaining(phone_number));
	}, [phone_number, getOtpRemaining, startFrom]);

	const { submitHandler, isSending, response } = useMutate<
		LoginApiDataResponse,
		loginFormValue
	>({
		url: AUTH_URLS.LOGIN,
		hasHeader: false,
		onError(err) {
			toast.error(authErrorMessage(err));
		},
	});

	useEffect(() => {
		const tokens = response?.result?.tokens;
		if (tokens) {
			login(tokens.access_token, tokens.refresh_token);
		}
	}, [response?.result?.tokens, login]);

	const handleChangeOtp = useCallback(
		(otp: string) => {
			setOtp(otp);
			setValue("otp", otp);
		},
		[setValue],
	);

	// The code input accepts only Latin digits; a Persian keyboard types ۱۲۳۴. Convert them in
	// the input before it looks, and handle a pasted code (either kind of digit) here.
	const latinize = (event: React.FormEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const converted = persianNumberConverter(input.value);
		if (converted !== input.value) input.value = converted;
	};
	const handlePasteOtp = (event: React.ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		const digits = persianNumberConverter(event.clipboardData.getData("text/plain"))
			.replace(/\D/g, "")
			.slice(0, 4);
		if (digits) handleChangeOtp(digits);
	};

	return (
		<Box
			ref={pageContainerRef}
			sx={{
				position: "relative",
				width: "100%",
				height: "100vh",
				maxHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				backgroundColor: "#E9EEF3",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					flex: "1 1 auto",
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					paddingTop: { xs: 2, sm: 3 },
					paddingX: { xs: 2, sm: 3 },
					overflow: "hidden",
				}}
			>
				<ImageBox
					src={PANDA_AUTH}
					sx={{
						width: { xs: "280px" },
						maxWidth: "100%",
						height: "auto",
						aspectRatio: "auto",
						objectFit: "contain",
					}}
				/>
			</Box>
			<Box
				sx={{
					width: "100%",
					flexShrink: 0,
					backgroundColor: "common.white",
					padding: { xs: "20px 18px" },
					borderRadius: { xs: "40px 40px 0 0", sm: "40px 60px 0 0" },
					boxSizing: "border-box",
					boxShadow: "0px 2px 4px -1px #00000033, 0px 4px 5px 0px #00000024",
					display: "flex",
					flexDirection: "column",
					gap: { xs: 2.5, sm: 3 },
					height: { xs: "55vh" },
					overflowY: "auto",
					justifyContent: "space-between",
				}}
			>
				<Box display="flex" flexDirection="column" gap={1.5}>
					<Typography variant={bold20}>تایید شماره موبایل</Typography>
					<Typography variant={regular16} color="grey.500">
						کد ارسال شده به شماره {phone_number} را وارد کنید.
					</Typography>
					<Typography
						sx={{ cursor: "pointer" }}
						onClick={() => push(REGISTER.path)}
						color="secondary.600"
					>
						ویرایش شماره
					</Typography>
					<Box
						display="flex"
						flexDirection="column"
						gap={3}
						alignItems="center"
						sx={{ paddingTop: 2 }}
					>
						<OtpInput
							value={otp}
							inputType="tel"
							onChange={handleChangeOtp}
							numInputs={4}
							renderInput={(props, index) => (
								<input
									{...props}
									// Lets the phone offer the code from the SMS (all 4 digits at once).
									autoComplete={index === 0 ? "one-time-code" : "off"}
									aria-label={`رقم ${index + 1} از ۴ کد تأیید`}
									onInput={(event) => {
										latinize(event);
										props.onInput(event);
									}}
									onChange={(event) => {
										latinize(event);
										props.onChange(event);
									}}
									onPaste={handlePasteOtp}
								/>
							)}
							containerStyle={{
								gap: 12,
								flexDirection: "row-reverse",
								width: "100%",
								display: "flex",
							}}
							inputStyle={{
								flex: 1,
								height: "48px",
								fontSize: 14,
								borderRadius: "12px",
								textAlign: "center",
								border: `1px solid #235789`,
								WebkitAppearance: "none",
								MozAppearance: "textfield",
							}}
						/>
						{counter ? (
							<Typography variant={regular12}>
								{time} ثانیه تا ارسال دوباره کد
							</Typography>
						) : (
							<Button
								variant="text"
								size="small"
								onClick={() =>
									resendOtp(phone_number, {
										onSuccess: () => {
											markOtpSent(phone_number);
											resetCounter();
											setOtp("");
										},
										onError: (error) => toast.error(authErrorMessage(error)),
									})
								}
							>
								ارسال مجدد
							</Button>
						)}
						{!userAlreadyExist && (
							<Typography
								sx={{ cursor: "pointer", textAlign: "left", width: "100%" }}
								onClick={() => setIsReferralModalOpen(true)}
								color="secondary.600"
								variant={regular16}
							>
								آیا کد معرف دارید؟
							</Typography>
						)}
					</Box>
				</Box>
				<LoadingButton
					disabled={otp.length !== 4 || !phone_number}
					onClick={handleSubmit(submitHandler)}
					isLoading={isSending}
					fullWidth
					sx={{ borderRadius: "12px", mb: "16px" }}
				>
					تایید و ادامه
				</LoadingButton>
			</Box>
			<Modal
				open={isReferralModalOpen}
				onClose={() => setIsReferralModalOpen(false)}
				TransitionComponent={Slide}
				TransitionProps={
					{
						direction: "up",
					} as any
				}
				// مودال داخل باکس اصلی صفحه portal و absolute می‌شود تا backdrop هم فقط
				// روی همان باکس (حداکثر ۶۰۰px) بیفتد، نه کل صفحه. روی موبایل کل عرض باکس
				// را می‌گیرد (ریسپانسیو سالم).
				container={() => pageContainerRef.current}
				sx={{
					position: "absolute",
					"& .MuiBackdrop-root": {
						position: "absolute",
					},
					"& .MuiDialog-container": {
						alignItems: "flex-end",
						justifyContent: "center",
					},
					"& .MuiDialog-paper": {
						margin: 0,
						width: "100%",
						maxWidth: "100%",
						borderRadius: "24px 24px 0 0",
						padding: 0,
						maxHeight: "auto",
					},
				}}
			>
				<Box
					sx={{
						padding: "20px 18px",
						display: "flex",
						flexDirection: "column",
						gap: 5,
					}}
				>
					<Box display="flex" flexDirection="column" gap={3}>
						<Typography variant="14-medium" color="grey.700">
							کد معرف را وارد کنید.
						</Typography>
						<TextField
							form={loginForm}
							name="referral_code"
							label="کد معرف"
							placeholder="کد معرف را وارد نمایید"
							inputType="string"
						/>
					</Box>
					<Box display="flex" gap={1} sx={{ paddingTop: 1, pb: "16px" }}>
						<Button
							variant="contained"
							color="info"
							onClick={() => {
								setIsReferralModalOpen(false);
							}}
							sx={{ borderRadius: "12px", flex: 1 }}
						>
							ثبت
						</Button>
					</Box>
				</Box>
			</Modal>
		</Box>
	);
}
