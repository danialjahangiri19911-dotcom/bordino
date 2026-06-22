import { useForm } from "react-hook-form";

import { type registerFormValue, registerSchema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useRegisterForm() {
	return useForm<registerFormValue>({
		mode: "onBlur",
		resolver: yupResolver(registerSchema),
	});
}
