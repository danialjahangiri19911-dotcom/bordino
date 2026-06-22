import type { ReactNode } from "react";
import type {
	FieldValues,
	SubmitHandler,
	UseFormReturn,
} from "react-hook-form";

import Box from "@libs/components/atoms/Box";
import IconButton from "@libs/components/atoms/IconButton";
import LinearProgress, {
	linearProgressClasses,
} from "@libs/components/atoms/LinearProgress";
import Typography from "@libs/components/atoms/Typography";
import Back from "@libs/components/icons/components/Back";
import LoadingButton from "@libs/components/loading/LoadingButton";
import styled from "@libs/styles/styled";

import useVariants from "@/libs/uiHooks/useVariants";

interface Props<F extends FieldValues> {
	activeStep: number;
	handlePrev: () => void;
	form: UseFormReturn<F>;
	submitHandler: SubmitHandler<F>;
	isSubmitting?: boolean;
	title: string;
	children: ReactNode;
	stepsCount: number;
}
export default function LinearStepper<F extends FieldValues>({
	activeStep,
	form,
	handlePrev,
	submitHandler,
	isSubmitting,
	children,
	stepsCount,
	title,
}: Readonly<Props<F>>) {
	const { bold20 } = useVariants();

	return (
		<Wrapper>
			<ContentWrapper>
				<Box display="flex" flexDirection="column" gap={3}>
					<Box display="flex" gap={1} alignItems="center">
						<BorderLinearProgress
							variant="determinate"
							value={(activeStep / stepsCount) * 100}
							sx={{ width: activeStep !== 1 ? "90%" : "100%" }}
						/>
						{activeStep !== 1 && (
							<IconButton onClick={handlePrev}>
								<Back />
							</IconButton>
						)}
					</Box>
					<Typography variant={bold20}>{title}</Typography>
				</Box>
				{children}
			</ContentWrapper>
			<LoadingButton
				isLoading={isSubmitting}
				onClick={form.handleSubmit(submitHandler)}
				fullWidth
			>
				{stepsCount === activeStep ? "ورود به برنامه" : `تایید و ادامه`}
			</LoadingButton>
		</Wrapper>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	justifyContent: "space-between",
	padding: theme.spacing(2),
	alignItems: "center",
	height: "90vh",
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	gap: theme.spacing(4),
	flexDirection: "column",
	width: "100%",
}));

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
	height: 16,
	borderRadius: 40,
	[`&.${linearProgressClasses.colorPrimary}`]: {
		backgroundColor: theme.palette.grey[200],
	},
	[`& .${linearProgressClasses.bar}`]: {
		borderRadius: 40,
		backgroundColor: theme.palette.primary[500],
		boxShadow: "inset 0px 2px 4px rgba(0, 0, 0, 0.15)",
	},
	rotate: "180deg",
}));
