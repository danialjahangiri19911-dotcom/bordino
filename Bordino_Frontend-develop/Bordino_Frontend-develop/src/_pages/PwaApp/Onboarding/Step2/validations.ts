import * as yup from "yup";

export const step2Schema = yup.object({
	daily_usage_minutes: yup.string().required("باید یکی از موارد انتخاب شود"),
});

export type Step2FormValue = yup.InferType<typeof step2Schema>;
