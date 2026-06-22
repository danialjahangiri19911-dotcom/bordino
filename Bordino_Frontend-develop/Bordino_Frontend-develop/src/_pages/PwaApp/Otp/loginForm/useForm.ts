import { useForm } from "react-hook-form";

import { type loginFormValue, loginSchema } from "./validations";
import { yupResolver } from "@hookform/resolvers/yup";

export default function useLoginForm() {
	return useForm<loginFormValue>({
		mode: "onBlur",
		resolver: yupResolver(loginSchema),
	});
}
