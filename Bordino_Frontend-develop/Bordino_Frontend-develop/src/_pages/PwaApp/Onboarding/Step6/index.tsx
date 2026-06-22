import React from "react";
import { useSwipeable } from "react-swipeable";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import BaseStepper, { Step, StepLabel } from "@libs/components/atoms/Stepper";
import Typography from "@libs/components/atoms/Typography";

import { INTRO_DATA } from "@/_pages/PwaApp/Intro/constants";
import ImageBox from "@/libs/components/ImageBox";
import StepIcon from "@/libs/components/Stepper/DotsStepper/StepIcon";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";

export default function Step6({
	activeStep,
	handleNext,
	handlePrev,
}: Readonly<StepProps>) {
	const stepData = INTRO_DATA[1]; // Second description page
	const stepIndex = activeStep - 5; // Step6 is index 1 in description pages (0-indexed from Step5)

	const handlers = useSwipeable({
		onSwipedLeft: () => {
			handleNext();
		},
		onSwipedRight: () => {
			handlePrev();
		},
		trackMouse: true,
		delta: 50,
	});

	return (
		<Box
			{...handlers}
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
			>
				<ImageBox
					src={stepData.image}
					alt={stepData.title}
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
					<Typography variant="20-bold">{stepData.title}</Typography>
					<Typography textAlign="center" variant="16-regular">
						{stepData.message}
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
							activeStep={stepIndex}
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
							{INTRO_DATA.map((_step, index) => (
								<Step key={index}>
									<StepLabel
										sx={{
											padding: 0,
											"& .MuiStepLabel-iconContainer": {
												padding: 0,
											},
										}}
										icon={<StepIcon active={stepIndex === index} />}
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
					ادامه
				</Button>
			</Box>
		</Box>
	);
}
