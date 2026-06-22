import * as yup from "yup";

export const step1Schema = yup.object({
	username: yup
		.string()
		.trim()
		.required("این فیلد اجباری میباشد")
		.min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
		.max(20, "نام کاربری نمی‌تواند بیشتر از ۲۰ کاراکتر باشد")
		.matches(
			/^[a-zA-Z0-9_]+$/,
			"نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و زیرخط باشد",
		)
		.test(
			"no-spaces",
			"نام کاربری نمی‌تواند شامل فاصله باشد",
			(value) => !value?.includes(" "),
		)
		.test("starts-with-letter", "نام کاربری باید با حرف شروع شود", (value) => {
			if (!value) return false;
			return /^[a-zA-Z]/.test(value);
		}),
	birthdate: yup.string().required("تاریخ تولد اجباری میباشد"),
	gender: yup
		.string()
		.required("جنسیت اجباری میباشد")
		.oneOf(["F", "M"], "جنسیت باید مرد یا زن باشد"),
});

export type Step1FormValue = yup.InferType<typeof step1Schema>;
