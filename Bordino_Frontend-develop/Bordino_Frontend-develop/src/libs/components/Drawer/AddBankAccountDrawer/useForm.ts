import { useForm } from "react-hook-form";

import {
	type AddBankAccountFormValue,
	addBankAccountSchema,
} from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useAddBankAccountForm() {
	return useForm<AddBankAccountFormValue>({
		mode: "onBlur",
		resolver: yupResolver(addBankAccountSchema),
		defaultValues: {
			iban: "",
			bank: "",
			accountHolder: "",
		},
	});
}
