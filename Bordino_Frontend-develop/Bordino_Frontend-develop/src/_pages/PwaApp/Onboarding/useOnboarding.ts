import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import type { RegistrationStepName } from "@/api/customer/types/getCustomerProfileType";
import { RegistrationStepEnum } from "@/api/customer/types/getCustomerProfileType";
import { MAIN_APP } from "@/constants/routes";

export default function useOnboarding() {
	const { data, error } = useGetCustomerProfile();

	const { push } = useRouter();
	const extractCurrentStep = useMemo(() => {
		const stepName = data?.result.registration_step;
		if (stepName) {
			const calculatedStep =
				RegistrationStepEnum[
					data?.result.registration_step as RegistrationStepName
				];
			// ] + 1;
			// if (calculatedStep >= 2 && calculatedStep <= 4) {
			// 	return 5;
			// }
			return calculatedStep;
		} else {
			return 1;
		}
	}, [data?.result.registration_step]);

	const [step, setStep] = useState(extractCurrentStep);
	const isManualStepRef = useRef(false);

	useEffect(() => {
		if (isManualStepRef.current || step >= 5) {
			return;
		}
		if (extractCurrentStep !== step) {
			setStep(extractCurrentStep);
		}
	}, [extractCurrentStep, step]);
	useEffect(() => {
		// if (step >= 2 && step <= 4) {
		// 	isManualStepRef.current = true;
		// 	setStep(5);
		// } else
		if (step > 7) {
			push(MAIN_APP.path);
		}
	}, [push, step]);

	const mustRegisterUser = useMemo(() => {
		if (error && error.status === 404) {
			return true;
		}
		if (!error && !data) {
			return true;
		}
		if (!(data?.result.birthdate && data.result.username)) return true;
		return false;
	}, [data, error]);

	const handleNext = useCallback(() => {
		isManualStepRef.current = true;
		setStep((prevStep) => {
			const nextStep = prevStep + 1;
			if (nextStep >= 2 && nextStep <= 4) {
				return 5;
			}
			return nextStep;
		});
	}, []);

	const handlePrev = useCallback(() => {
		setStep((prevStep) => {
			const prevStepNum = prevStep - 1;
			if (prevStepNum >= 2 && prevStepNum <= 4) {
				return 1;
			}
			return prevStepNum;
		});
	}, []);

	const setStepDirectly = useCallback((stepNumber: number) => {
		isManualStepRef.current = true;
		setStep(() => stepNumber);
		if (stepNumber >= 5) {
			isManualStepRef.current = true;
		}
	}, []);

	return {
		step,
		handleNext,
		handlePrev,
		mustRegisterUser,
		setStepDirectly,
		push,
	};
}
