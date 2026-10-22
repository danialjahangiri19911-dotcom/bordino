import * as yup from "yup";

import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

/** «ir ۱۲ ۳۴…» → "IR1234…" (Latin digits, no spaces/dashes, IR added when typed without it). */
export function normalizeIban(value: string) {
	const iban = persianNumberConverter(value || "")
		.replace(/[\s-]/g, "")
		.toUpperCase();
	return /^\d{24}$/.test(iban) ? `IR${iban}` : iban;
}

/** An Iranian Sheba number: IR + 24 digits passing the ISO 13616 mod-97 check (as the server). */
export function isValidIban(iban: string) {
	if (!/^IR\d{24}$/.test(iban)) return false;
	const rearranged = iban.slice(4) + iban.slice(0, 4);
	const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
	let remainder = 0;
	for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
	return remainder === 1;
}

export const addBankAccountSchema = yup.object({
	iban: yup
		.string()
		.trim()
		.required("این فیلد اجباری میباشد")
		.test(
			"ir-iban-format",
			"شماره شبا باید IR و ۲۴ رقم باشد (مثل IR062960000000100324200001)",
			(value) => /^IR\d{24}$/.test(normalizeIban(value || "")),
		)
		.test("iban-checksum", "شماره شبا معتبر نیست؛ آن را دوباره بررسی کنید.", (value) =>
			isValidIban(normalizeIban(value || "")),
		),
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
