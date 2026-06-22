import * as yup from "yup";

export const step3Schema = yup.object({
	signup_reasons: yup
		.array()
		.of(yup.string())
		.required("حداقل یکی از موارد باید انتخاب شود ."),
});

export type Step3FormValue = yup.InferType<typeof step3Schema>;
