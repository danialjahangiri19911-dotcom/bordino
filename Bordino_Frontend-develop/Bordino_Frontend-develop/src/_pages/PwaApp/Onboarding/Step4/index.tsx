import React, { useCallback, useEffect } from "react";

import useStep4Form from "./useForm";
import useStep4 from "./useStep4";

import useGeneralStepOnSuccess from "@/_pages/PwaApp/Onboarding/useGeneralStepOnSuccess";
import useGetInterestSelection from "@/api/customer/hooks/useGetInterestSelection";
import { CUSTOMER_URLS } from "@/api/urls";
import LinearStepper from "@/libs/components/Stepper/LinearStepper";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import MultiPictureChoiceFields from "@/libs/components/fields/Choice/Multi/MultiPictureChoiceFields";
import useMutate from "@/libs/http/useMutate";

export default function Step4({
	activeStep,
	handleNext,
	handlePrev,
	stepsCount,
}: Readonly<StepProps>) {
	const form = useStep4Form();
	const { data } = useGetInterestSelection();
	const { STEP4_OPTIONS } = useStep4();

	useEffect(() => {
		if (data?.result) {
			form.reset(data.result);
		}
	}, [data?.result, form]);

	const { onSuccess } = useGeneralStepOnSuccess({ handleNext });

	const handleOnSuccess = useCallback(() => {
		onSuccess();
	}, [onSuccess]);

	const { submitHandler, isSending } = useMutate({
		url: CUSTOMER_URLS.INTEREST_SELECTION,
		hasHeader: true,
		onSuccess: handleOnSuccess,
		method: "PATCH",
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
			<MultiPictureChoiceFields
				form={form}
				name="favorite_categories"
				options={STEP4_OPTIONS}
			/>
		</LinearStepper>
	);
}
