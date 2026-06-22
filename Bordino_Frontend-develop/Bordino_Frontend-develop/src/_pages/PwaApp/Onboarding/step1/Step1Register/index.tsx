"use client";

import { memo, useCallback, useState } from "react";

import BaseStep1 from "@/_pages/PwaApp/Onboarding/step1/BaseStep1";
import useStep1 from "@/_pages/PwaApp/Onboarding/step1/useStep1";
import { useQueryClient } from "@tanstack/react-query";

import { CUSTOMER_URLS } from "@/api/urls";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import useMutate from "@/libs/http/useMutate";
import useUserStore from "@/libs/stores/userStore";

interface Step1RegisterProps extends StepProps {
	setStepDirectly?: (stepNumber: number) => void;
}

function Step1Register({
	activeStep,
	stepsCount,
	handlePrev,
	setStepDirectly,
	handleNext,
}: Readonly<Step1RegisterProps>) {
	const step1CommonProps = useStep1();
	const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
	const { setUser } = useUserStore();
	const queryClient = useQueryClient();

	const handleWelcomeDialogClose = useCallback(() => {
		setShowWelcomeDialog(false);
		if (setStepDirectly) {
			setStepDirectly(5);
		}
	}, [setStepDirectly]);

	const { submitHandler, isSending } = useMutate({
		url: CUSTOMER_URLS.CUSTOMER_REGISTER,
		hasHeader: true,
		onSuccess: () => {
			setShowWelcomeDialog(true);
			setUser({
				registrationStep: "DailyUsageTime",
				gender: step1CommonProps.form.getValues("gender") as "F" | "M",
			});
			queryClient.invalidateQueries();
		},
	});

	return (
		<BaseStep1
			handlePrev={handlePrev}
			activeStep={activeStep}
			stepsCount={stepsCount}
			{...step1CommonProps}
			submitHandler={submitHandler}
			isSubmitting={isSending}
			onWelcomeDialogClose={handleWelcomeDialogClose}
			showWelcomeDialog={showWelcomeDialog}
			handleNext={handleNext}
		/>
	);
}

export default memo(Step1Register);
