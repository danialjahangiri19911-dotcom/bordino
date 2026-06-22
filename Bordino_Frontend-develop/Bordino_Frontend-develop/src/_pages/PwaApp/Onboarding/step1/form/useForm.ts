import { useForm } from "react-hook-form";

import { type Step1FormValue, step1Schema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useStep1Form() {
	return useForm<Step1FormValue>({
		mode: "onBlur",
		resolver: yupResolver(step1Schema),
	});
}
