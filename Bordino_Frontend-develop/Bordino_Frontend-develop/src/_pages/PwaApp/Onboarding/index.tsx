"use client";

import React, { useEffect, useMemo, useRef } from "react";

import Step2 from "./Step2";
import Step3 from "./Step3";
import Step4 from "./Step4";
import Step5 from "./Step5";
import Step6 from "./Step6";
import Step7 from "./Step7";
import Step1Register from "./step1/Step1Register";
import Step1 from "./step1/Step1Update";
import useOnboarding from "./useOnboarding";
import Box from "@libs/components/atoms/Box";

import { MAIN_APP } from "@/constants/routes";
import useUserStore from "@/libs/stores/userStore";

export default function Onboarding() {
	const { step, mustRegisterUser, push, ...rest } = useOnboarding();

	const { user } = useUserStore();

	// Onboarding is for a profile that is not set up yet, decided when the player arrives. Saving
	// step 1 moves the stored step on, and that must not throw the player out halfway (the
	// welcome dialog and the intro slides come after it).
	const entered = useRef(false);
	if (user?.registrationStep === "ProfileSetup") entered.current = true;

	useEffect(() => {
		if (!entered.current) {
			push(MAIN_APP.path);
		}
	}, [push, user?.registrationStep]);

	const currentStep = useMemo(() => {
		switch (step) {
			case 1: {
				if (mustRegisterUser) {
					return <Step1Register {...rest} activeStep={step} stepsCount={7} />;
				} else {
					return <Step1 {...rest} activeStep={step} stepsCount={7} />;
				}
			}
			case 2: {
				return <Step2 activeStep={step} stepsCount={7} {...rest} />;
			}
			case 3: {
				return <Step3 activeStep={step} {...rest} stepsCount={7} />;
			}
			case 4: {
				return <Step4 activeStep={step} {...rest} stepsCount={7} />;
			}
			case 5: {
				return <Step5 activeStep={step} {...rest} stepsCount={7} />;
			}
			case 6: {
				return <Step6 activeStep={step} {...rest} stepsCount={7} />;
			}
			case 7: {
				return <Step7 activeStep={step} {...rest} stepsCount={7} />;
			}
		}
	}, [mustRegisterUser, rest, step]);

	if (!entered.current) {
		return null;
	}

	return <Box>{currentStep}</Box>;
}
