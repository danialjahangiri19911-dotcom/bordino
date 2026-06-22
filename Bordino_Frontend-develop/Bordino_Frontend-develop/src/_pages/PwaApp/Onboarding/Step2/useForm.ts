import { useForm } from "react-hook-form";

import { type Step2FormValue, step2Schema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useStep2Form() {
	return useForm<Step2FormValue>({
		mode: "onBlur",
		resolver: yupResolver(step2Schema),
	});
}
