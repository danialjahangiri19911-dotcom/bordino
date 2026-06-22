import * as yup from "yup";

export const registerSchema = yup.object({
	phone_number: yup
		.string()
		.trim()
		.required("این فیلد اجباری میباشد")
		.test(
			"english-keyboard",
			"شماره تلفن باید فقط با اعداد انگلیسی وارد شود",
			(value) => {
				return /^[0-9]*$/.test(value || "");
			},
		)
		.test(
			"start-with-09-or-9",
			"شماره تلفن باید با 09 یا 9 شروع شود",
			(value) => {
				return value?.startsWith("09") || value?.startsWith("9");
			},
		)
		.test("length", "شماره تلفن باید 10 یا 11 رقم باشد", (value) => {
			if (!value) return false;
			if (value.startsWith("0")) {
				return value.length === 11;
			}
			return value.length === 10;
		}),
});

export type registerFormValue = yup.InferType<typeof registerSchema>;
