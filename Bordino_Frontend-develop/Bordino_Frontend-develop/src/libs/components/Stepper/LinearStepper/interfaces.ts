export interface StepProps {
	stepsCount: number;
	activeStep: number;
	handleNext: () => void;
	handlePrev: () => void;
}
