import * as yup from "yup";

export const step4Schema = yup.object({
	favorite_categories: yup
		.array()
		.of(yup.string())
		.required("حداقل یکی از موارد باید انتخاب شود ."),
});

export type Step4FormValue = yup.InferType<typeof step4Schema>;
