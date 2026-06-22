import React, { useEffect } from "react";

import { STEP3_OPTIONS } from "./constants";
import useStep3Form from "./useForm";

import useGeneralStepOnSuccess from "@/_pages/PwaApp/Onboarding/useGeneralStepOnSuccess";
import useGetUsageGoal from "@/api/customer/hooks/useGetUsageGoal";
import { CUSTOMER_URLS } from "@/api/urls";
import LinearStepper from "@/libs/components/Stepper/LinearStepper";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import MultiChoiceFields from "@/libs/components/fields/Choice/Multi/Field";
import useMutate from "@/libs/http/useMutate";

export default function Step3({
	activeStep,
	handleNext,
	handlePrev,
	stepsCount,
}: Readonly<StepProps>) {
	const form = useStep3Form();

	const { data } = useGetUsageGoal();

	useEffect(() => {
		if (data?.result) {
			form.reset(data.result);
		}
	}, [data?.result, form]);

	const { onSuccess } = useGeneralStepOnSuccess({ handleNext });

	const { submitHandler, isSending } = useMutate({
		url: CUSTOMER_URLS.USAGE_GOAL,
		hasHeader: true,
		method: "PATCH",
		onSuccess,
	});

	return (
		<LinearStepper
			form={form}
			activeStep={activeStep}
			stepsCount={stepsCount}
			handlePrev={handlePrev}
			title="چرا دارید از برنامه ما استفاده میکنید ؟"
			submitHandler={submitHandler}
			isSubmitting={isSending}
		>
			<MultiChoiceFields
				form={form}
				name="signup_reasons"
				options={STEP3_OPTIONS}
			/>
		</LinearStepper>
	);
}
