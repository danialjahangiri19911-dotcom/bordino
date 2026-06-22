import { useForm } from "react-hook-form";

import type { Step4FormValue } from "./validations";
import { step4Schema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useStep4Form() {
	return useForm<Step4FormValue>({
		mode: "onChange",
		resolver: yupResolver(step4Schema),
	});
}
