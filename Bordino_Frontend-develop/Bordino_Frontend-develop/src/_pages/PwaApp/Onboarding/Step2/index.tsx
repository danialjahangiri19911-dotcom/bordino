import React, { useEffect } from "react";

import { STEP2_OPTIONS } from "./constants";
import useStep2Form from "./useForm";
import Box from "@libs/components/atoms/Box";
import useGeneralStepOnSuccess from "@pages/PwaApp/Onboarding/useGeneralStepOnSuccess";

import useGetDailyUsageTime from "@/api/customer/hooks/useGetDailyUsageTime";
import { CUSTOMER_URLS } from "@/api/urls";
import { PANDA_UPDATE_INFO } from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";
import LinearStepper from "@/libs/components/Stepper/LinearStepper";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import SingleChoiceFields from "@/libs/components/fields/Choice/Single";
import useMutate from "@/libs/http/useMutate";

export default function Step2({
	activeStep,
	handleNext,
	handlePrev,
	stepsCount,
}: Readonly<StepProps>) {
	const form = useStep2Form();

	const { data } = useGetDailyUsageTime();

	useEffect(() => {
		if (data?.result) {
			form.reset(data.result);
		}
	}, [data?.result, form]);

	const { onSuccess } = useGeneralStepOnSuccess({ handleNext });

	const { submitHandler, isSending } = useMutate({
		url: CUSTOMER_URLS.DAILY_USAGE_TIME,
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
			isSubmitting={isSending}
			title="چه مقدار زمانی در روز میخواهید از برنامه ما استفاده کنید؟"
			submitHandler={submitHandler}
		>
			<Box
				display="flex"
				flexDirection="column"
				gap={5}
				justifyContent="space-between"
			>
				<SingleChoiceFields
					form={form}
					name="daily_usage_minutes"
					options={STEP2_OPTIONS}
				/>
				<ImageBox
					src={PANDA_UPDATE_INFO}
					sx={{
						width: { xs: "100%", sm: "auto" },
						maxWidth: { xs: "280px", sm: "none" },
						height: "auto",
						aspectRatio: "auto",
						alignSelf: "center",
						objectFit: "contain",
					}}
				/>
			</Box>
		</LinearStepper>
	);
}
