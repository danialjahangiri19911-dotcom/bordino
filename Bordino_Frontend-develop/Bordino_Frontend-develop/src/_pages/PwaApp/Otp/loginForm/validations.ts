import * as yup from "yup";

export const loginSchema = yup.object({
	phone_number: yup
		.string()
		.required("این فیلد اجباری میباشد")
		.max(10, "شماره تلفن نمیتواند بیشتر از 10 عدد باشد")
		.min(10, "شماره تلفن باید 10 رقم باشد"),
	otp: yup
		.string()
		.required("این فیلد اجباری است")
		.max(6, "کد باید 6 رقم باشد."),
	referral_code: yup.string().optional(),
});

export type loginFormValue = yup.InferType<typeof loginSchema>;
