import * as yup from "yup";

import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

const extractNumericValue = (value: string): number => {
	const cleaned = value.replace(/[^\d۰-۹]/g, "");
	const converted = persianNumberConverter(cleaned);
	return Number(converted);
};

export const createWithdrawCurrencySchema = (availableBalance: number) =>
	yup.object({
		amount: yup
			.string()
			.trim()
			.required("این فیلد اجباری میباشد")
			.test("is-number", "مبلغ باید یک عدد معتبر باشد", (value) => {
				if (!value) return false;
				const numValue = extractNumericValue(value);
				return !isNaN(numValue) && numValue > 0;
			})
			.test(
				"max-balance",
				`مبلغ نمی‌تواند بیشتر از ${availableBalance.toLocaleString("fa-IR")} تومان باشد`,
				(value) => {
					if (!value) return false;
					const numValue = extractNumericValue(value);
					return numValue <= availableBalance;
				},
			),
		bankAccountId: yup.string().required("انتخاب شماره شبا اجباری میباشد"),
	});

export type WithdrawCurrencyFormValue = {
	amount: string;
	bankAccountId: string;
};
