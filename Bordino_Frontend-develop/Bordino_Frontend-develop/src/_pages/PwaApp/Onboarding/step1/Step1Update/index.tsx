"use client";

import { useEffect } from "react";

import BaseStep1 from "@pages/PwaApp/Onboarding/step1/BaseStep1";
import useStep1 from "@pages/PwaApp/Onboarding/step1/useStep1";
import useGeneralStepOnSuccess from "@pages/PwaApp/Onboarding/useGeneralStepOnSuccess";

import useGetProfileSetup from "@/api/customer/hooks/useGetProfileSetup";
import { CUSTOMER_URLS } from "@/api/urls";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import useMutate from "@/libs/http/useMutate";

export default function Step1({
	activeStep,
	handleNext,
	stepsCount,
	handlePrev,
}: Readonly<StepProps>) {
	const step1CommonProps = useStep1();

	const { data } = useGetProfileSetup();

	useEffect(() => {
		if (data?.result) {
			step1CommonProps.form.reset(data.result);
		}
	}, [data?.result, step1CommonProps.form]);

	const { onSuccess } = useGeneralStepOnSuccess({ handleNext });

	const { submitHandler, isSending } = useMutate({
		url: CUSTOMER_URLS.PROFILE_SETUP,
		hasHeader: true,
		method: "PATCH",
		onSuccess,
	});

	return (
		<BaseStep1
			handlePrev={handlePrev}
			activeStep={activeStep}
			stepsCount={stepsCount}
			{...step1CommonProps}
			submitHandler={submitHandler}
			isSubmitting={isSending}
			handleNext={handleNext}
		/>
	);
}
