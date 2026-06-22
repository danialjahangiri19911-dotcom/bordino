"use client";

import React, { memo, useCallback, useState } from "react";

import StepIcon from "./StepIcon";
import ImageBox from "@libs/components/ImageBox";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import BaseStepper, { Step, StepLabel } from "@libs/components/atoms/Stepper";
import Typography from "@libs/components/atoms/Typography";

interface StepProps {
	title: string;
	message: string;
	image: string;
}
interface Props {
	steps: StepProps[];
	onComplete: () => void;
}
function Stepper({ steps, onComplete }: Readonly<Props>) {
	const [activeStep, setActiveStep] = useState(0);

	const handleNext = useCallback(() => {
		if (activeStep === steps.length - 1) {
			onComplete();
		} else {
			setActiveStep((prevActiveStep) => prevActiveStep + 1);
		}
	}, [activeStep, onComplete, steps.length]);

	const handlePrev = useCallback(() => {
		if (activeStep > 0) {
			setActiveStep((prevActiveStep) => prevActiveStep - 1);
		}
	}, [activeStep]);

	const handleSwipe = useCallback(
		(direction: "left" | "right") => {
			if (direction === "left") {
				handleNext();
			} else if (direction === "right") {
				handlePrev();
			}
		},
		[handleNext, handlePrev],
	);

	let startX: number;
	const handleTouchStart = (e: React.TouchEvent) => {
		startX = e.touches[0].clientX;
	};
	const handleTouchMove = (e: React.TouchEvent) => {
		const currentX = e.touches[0].clientX;
		const diffX = startX - currentX;
		if (diffX > 50) {
			handleSwipe("left");
		} else if (diffX < -50) {
			handleSwipe("right");
		}
	};
	return (
		<Box
			sx={{
				position: "relative",
				width: "100%",
				height: "100vh",
				maxHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				backgroundColor: "#E9EEF3",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					flex: "1 1 auto",
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					paddingTop: { xs: 2, sm: 3 },
					paddingX: { xs: 2, sm: 3 },
					overflow: "hidden",
				}}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
			>
				<ImageBox
					src={steps[activeStep].image}
					alt={steps[activeStep].title}
					sx={{
						width: { xs: "280px" },
						maxWidth: "100%",
						height: "auto",
						aspectRatio: "auto",
						objectFit: "contain",
					}}
				/>
			</Box>
			<Box
				sx={{
					width: "100%",
					flexShrink: 0,
					backgroundColor: "common.white",
					padding: { xs: "24px 16px 20px", sm: "28px 20px 24px" },
					borderRadius: { xs: "40px 40px 0 0", sm: "40px 60px 0 0" },
					boxSizing: "border-box",
					boxShadow: "0px 2px 4px -1px #00000033, 0px 4px 5px 0px #00000024",
					display: "flex",
					flexDirection: "column",
					gap: { xs: 2.5, sm: 3 },
					height: { xs: "55vh" },
					overflowY: "auto",
					justifyContent: "space-between",
				}}
			>
				<Box
					display="flex"
					flexDirection="column"
					gap={1.5}
					alignItems="center"
					paddingY="28px"
					paddingX="16px"
				>
					<Typography variant="20-bold">{steps[activeStep].title}</Typography>
					<Typography textAlign="center" variant="16-regular">
						{steps[activeStep].message}
					</Typography>
					<Box
						sx={{
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							paddingY: { xs: 0.5, sm: 1 },
						}}
					>
						<BaseStepper
							activeStep={activeStep}
							sx={{
								"& .MuiStepConnector-root": {
									display: "none",
								},
								"& .MuiStep-root": {
									padding: 0,
									margin: 0,
								},
								"&.MuiStepper-root": {
									flexDirection: "row-reverse",
									gap: { xs: 1, sm: 1.5 },
								},
							}}
						>
							{steps.map((step, index) => (
								<Step key={step.title}>
									<StepLabel
										sx={{
											padding: 0,
											"& .MuiStepLabel-iconContainer": {
												padding: 0,
											},
										}}
										icon={<StepIcon active={activeStep === index} />}
									/>
								</Step>
							))}
						</BaseStepper>
					</Box>
				</Box>

				<Button
					onClick={handleNext}
					fullWidth
					variant="contained"
					color="primary"
					sx={{ borderRadius: "12px", mb: "16px" }}
				>
					{activeStep === steps.length - 1 ? "شروع" : "ادامه"}
				</Button>
			</Box>
		</Box>
	);
}

export default memo(Stepper);
