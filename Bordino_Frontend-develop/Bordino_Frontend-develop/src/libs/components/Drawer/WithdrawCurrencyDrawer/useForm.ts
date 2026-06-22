import { useForm } from "react-hook-form";

import {
	type WithdrawCurrencyFormValue,
	createWithdrawCurrencySchema,
} from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useWithdrawCurrencyForm(availableBalance: number) {
	return useForm<WithdrawCurrencyFormValue>({
		mode: "onSubmit",
		resolver: yupResolver(createWithdrawCurrencySchema(availableBalance)),
		defaultValues: {
			amount: "",
			bankAccountId: "",
		},
	});
}
