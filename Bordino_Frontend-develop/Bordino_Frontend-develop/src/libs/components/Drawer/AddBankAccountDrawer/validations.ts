import * as yup from "yup";

const irIbanRegex = /^IR\d{24}$/;

export const addBankAccountSchema = yup.object({
	iban: yup
		.string()
		.trim()
		.required("این فیلد اجباری میباشد")
		.test(
			"ir-iban-format",
			"شماره شبا باید با فرمت IR و 24 رقم باشد (IR123456789012345678901234)",
			(value) => {
				if (!value) return false;
				const cleaned = value.replace(/\s/g, "").toUpperCase();
				return irIbanRegex.test(cleaned);
			},
		)
		.test("iban-length", "شماره شبا باید 26 کاراکتر باشد", (value) => {
			if (!value) return false;
			const cleaned = value.replace(/\s/g, "").toUpperCase();
			return cleaned.length === 26;
		}),
	bank: yup.string().required("انتخاب بانک اجباری میباشد"),
	accountHolder: yup
		.string()
		.trim()
		.required("این فیلد اجباری میباشد")
		.min(2, "نام صاحب حساب باید حداقل ۲ کاراکتر باشد"),
});

export type AddBankAccountFormValue = yup.InferType<
	typeof addBankAccountSchema
>;
