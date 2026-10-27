"use client";

import { useCallback, useEffect } from "react";

import { useRouter } from "next/navigation";

import useRegisterForm from "./registerForm/useForm";
import type { registerFormValue } from "./registerForm/validations";
import ImageBox from "@libs/components/ImageBox";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";

import useResendOtp from "@/api/login/hooks/useResendOtp";
import type { RegisterApiDataResponse } from "@/api/login/types/registerType";
import { RegistrationType } from "@/api/login/types/registerType";
import { AUTH_URLS } from "@/api/urls";
import { PANDA_AUTH } from "@/constants/imagePaths";
import { MAIN_APP, OTP, RULES } from "@/constants/routes";
import Link from "@/libs/components/Link";
import TextField from "@/libs/components/fields/Textfield";
import LoadingButton from "@/libs/components/loading/LoadingButton";
import useMutate from "@/libs/http/useMutate";
import useAuthStore from "@/libs/stores/authStore";
import { useRegisterPhoneNumberStore } from "@/libs/stores/useUerRegisterPhoneNumber";

export default function Register() {
	const form = useRegisterForm();
	const { setPhoneNumber, phone_number, markOtpSent } =
		useRegisterPhoneNumberStore();
	const { setAlreadyExist, isLoggedIn } = useAuthStore();
	const { push } = useRouter();

	useEffect(() => {
		if (isLoggedIn) {
			push(MAIN_APP.path);
		}
	}, [isLoggedIn, push]);

	useEffect(() => {
		form.setValue("phone_number", phone_number);
	}, [form, phone_number]);

	const { resendOtp } = useResendOtp();

	const registerOnSuccess = useCallback(
		(data: RegisterApiDataResponse, variables: registerFormValue | undefined) => {
			// The number this answer is about is the one that was sent (already without its
			// leading 0), not what the field holds now: it may have been edited meanwhile.
			const normalizedPhoneNumber = variables?.phone_number ?? "";
			if (data.result.status === RegistrationType.isRegisteredBefore) {
				setPhoneNumber(normalizedPhoneNumber);
				setAlreadyExist(true);
				// اول به صفحه‌ی OTP می‌رویم: اگر OTP هنوز معتبر باشد، resend با خطای
				// «۶۰ ثانیه صبر کنید» رد می‌شود ولی چون روی مسیر /pwa/otp هستیم آن خطا
				// نمایش داده نمی‌شود و شمارش معکوس از زمان باقی‌مانده‌ی قبلی ادامه می‌یابد.
				push(OTP.path);
				resendOtp(normalizedPhoneNumber, {
					onSuccess: () => markOtpSent(normalizedPhoneNumber),
				});
			} else {
				setPhoneNumber(normalizedPhoneNumber);
				setAlreadyExist(false);
				markOtpSent(normalizedPhoneNumber);
				push(OTP.path);
			}
		},
		[push, resendOtp, setPhoneNumber, setAlreadyExist, markOtpSent],
	);

	const { submitHandler: baseSubmitHandler, isSending } = useMutate<
		RegisterApiDataResponse,
		registerFormValue
	>({
		url: AUTH_URLS.REGISTER,
		onSuccess: registerOnSuccess,
		hasHeader: false,
	});

	const submitHandler = useCallback(
		(data: registerFormValue) => {
			const phoneNumber = data.phone_number.startsWith("0")
				? data.phone_number.substring(1)
				: data.phone_number;
			baseSubmitHandler({ ...data, phone_number: phoneNumber });
		},
		[baseSubmitHandler],
	);

	const handleButtonClick = useCallback(() => {
		form.handleSubmit(submitHandler)();
	}, [form, submitHandler]);

	return (
		<Box
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
					<Typography variant="20-bold">ورود | ثبت‌نام</Typography>
					<Typography variant="16-regular">
						برای ورود یا ثبت‌نام شماره همراه خود را وارد کنید.
					</Typography>
					<TextField
						name="phone_number"
						form={form}
						label="شماره همراه"
						maxLen={11}
						inputType="number"
					/>
				</Box>
				<Box
					display="flex"
					flexDirection="column"
					gap={3}
					alignItems="center"
					mb="16px"
				>
					<LoadingButton
						fullWidth
						onClick={handleButtonClick}
						isLoading={isSending}
						sx={{ borderRadius: "12px" }}
					>
						ورود
					</LoadingButton>
					<Typography variant="12-regular">
						با ثبت‌نام در بردینو،
						<Link href={RULES.path}>شرایط و قوانین</Link> را قبول میکنم!
					</Typography>
				</Box>
			</Box>
		</Box>
	);
}
