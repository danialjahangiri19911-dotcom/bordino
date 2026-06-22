import { useForm } from "react-hook-form";

import { type Step3FormValue, step3Schema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useStep3Form() {
	return useForm<Step3FormValue>({
		mode: "onChange",
		resolver: yupResolver(step3Schema),
	});
}
