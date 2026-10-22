import type { SubmitHandler, UseFormReturn } from "react-hook-form";

import type { Step1FormValue } from "./form/validations";
import type { GENDER } from "./interfaces";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import IconButton from "@libs/components/atoms/IconButton";
import Typography from "@libs/components/atoms/Typography";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

import { FEMALE, MALE } from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";
import LinearStepper from "@/libs/components/Stepper/LinearStepper";
import type { StepProps } from "@/libs/components/Stepper/LinearStepper/interfaces";
import InputAdornment from "@/libs/components/atoms/InputAdornment";
import Modal from "@/libs/components/atoms/Modal";
import DatePicker from "@/libs/components/fields/Datepicker";
import TextField from "@/libs/components/fields/Textfield";

interface Props extends StepProps {
	form: UseFormReturn<Step1FormValue>;
	selectedGender: GENDER;
	onFemaleClick: () => void;
	onMaleClick: () => void;
	submitHandler: SubmitHandler<Step1FormValue>;
	isSubmitting: boolean;
	onWelcomeDialogClose?: () => void;
	showWelcomeDialog?: boolean;
}

export default function BaseStep1({
	activeStep,
	form,
	handlePrev,
	stepsCount,
	selectedGender,
	onFemaleClick,
	onMaleClick,
	submitHandler,
	isSubmitting,
	onWelcomeDialogClose,
	showWelcomeDialog = false,
}: Readonly<Props>) {
	const username = form.watch("username");
	const gender = form.watch("gender");
	const {
		formState: { errors, submitCount },
	} = form;

	const handleWelcomeDialogClose = () => {
		onWelcomeDialogClose?.();
	};

	const showGenderError = !gender && submitCount > 0;

	// The two pictures are the gender choice: reachable with Tab, chosen with Enter or Space.
	const choiceProps = (value: "F" | "M", label: string, choose: () => void) => ({
		role: "radio",
		tabIndex: 0,
		"aria-label": label,
		"aria-checked": selectedGender === value,
		onKeyDown: (event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				choose();
			}
		},
	});

	// No swipe to the next step here (the later slides have one): this step is a form, and the
	// only way forward is saving it, so a profile cannot be skipped or its typing lost.
	return (
		<Box>
			<LinearStepper
				form={form}
				activeStep={activeStep}
				stepsCount={stepsCount}
				isSubmitting={isSubmitting}
				handlePrev={handlePrev}
				title="لطفا مشخصات خود را پر کنید"
				submitHandler={submitHandler}
			>
				<TextField
					form={form}
					name="username"
					label="نام کاربری"
					placeholder="مثلا Mahdi1324"
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<AccountCircleOutlinedIcon />
							</InputAdornment>
						),
					}}
				/>
				<DatePicker
					label="سال تولد"
					form={form}
					name="birthdate"
					maxDate={new Date()}
				/>

				<Box display="flex" flexDirection="column" gap={1}>
					<Box
						role="radiogroup"
						aria-label="جنسیت"
						display="flex"
						gap={{ xs: 1.5, sm: 3 }}
						sx={{
							justifyContent: "space-between",
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						<Box
							display="flex"
							justifyContent="center"
							flexDirection="column"
							gap={1}
							alignItems="center"
							sx={{
								opacity: 1,
								transition: "all 0.3s ease",
							}}
						>
							<Box
								sx={{
									borderRadius: "50%",
									padding: "2px",
									border:
										showGenderError && selectedGender !== "F"
											? "2px solid #f44336"
											: "none",
									animation:
										showGenderError && selectedGender !== "F"
											? "pulse 1.5s infinite"
											: "none",
									"@keyframes pulse": {
										"0%": { boxShadow: "0 0 0 0 rgba(244, 67, 54, 0.7)" },
										"70%": { boxShadow: "0 0 0 10px rgba(244, 67, 54, 0)" },
										"100%": { boxShadow: "0 0 0 0 rgba(244, 67, 54, 0)" },
									},
								}}
							>
								<ImageBox
									src={FEMALE}
									sx={{
										cursor: "pointer",
										border:
											selectedGender === "F" ? "2px solid #E37D33" : "none",
										borderRadius: "50%",
										width: { xs: "130px", sm: "150px" },
										height: { xs: "130px", sm: "150px" },
										aspectRatio: "1 / 1",
										objectFit: "cover",
										transition: "all 0.3s ease",
										"&:hover": {
											transform: "scale(1.05)",
											boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
										},
									}}
									onClick={onFemaleClick}
									{...choiceProps("F", "زن", onFemaleClick)}
								/>
							</Box>
							<Typography
								variant="14-regular"
								sx={{
									color:
										selectedGender === "F" ? "primary.main" : "text.primary",
									fontWeight: selectedGender === "F" ? 600 : 400,
								}}
							>
								زن
							</Typography>
						</Box>

						<Box
							display="flex"
							justifyContent="center"
							flexDirection="column"
							gap={1}
							alignItems="center"
						>
							<Box
								sx={{
									borderRadius: "50%",
									padding: "2px",
									border:
										showGenderError && selectedGender !== "M"
											? "2px solid #f44336"
											: "none",
									animation:
										showGenderError && selectedGender !== "M"
											? "pulse 1.5s infinite"
											: "none",
								}}
							>
								<ImageBox
									src={MALE}
									sx={{
										cursor: "pointer",
										border:
											selectedGender === "M" ? "2px solid #E37D33" : "none",
										borderRadius: "50%",
										width: { xs: "130px", sm: "150px" },
										height: { xs: "130px", sm: "150px" },
										aspectRatio: "1 / 1",
										objectFit: "cover",
										transition: "all 0.3s ease",
										"&:hover": {
											transform: "scale(1.05)",
											boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
										},
									}}
									onClick={onMaleClick}
									{...choiceProps("M", "مرد", onMaleClick)}
								/>
							</Box>
							<Typography
								variant="14-regular"
								sx={{
									color:
										selectedGender === "M" ? "primary.main" : "text.primary",
									fontWeight: selectedGender === "M" ? 600 : 400,
								}}
							>
								مرد
							</Typography>
						</Box>
					</Box>

					{(errors.gender || showGenderError) && (
						<Typography
							variant="12-regular"
							color="error.main"
							sx={{
								mt: 1,
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								backgroundColor: "rgba(244, 67, 54, 0.08)",
								padding: "8px 12px",
								borderRadius: "8px",
							}}
						>
							<span>⚠️</span>
							{errors.gender?.message || "لطفا جنسیت خود را انتخاب کنید"}
						</Typography>
					)}
				</Box>
			</LinearStepper>

			<Modal
				open={showWelcomeDialog}
				onClose={handleWelcomeDialogClose}
				sx={{
					"& .MuiDialog-paper": {
						borderRadius: "24px",
						padding: 0,
						maxWidth: "300px",
						width: "300px",
					},
				}}
			>
				<Box
					sx={{
						px: "38px",
						py: "18px",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 2,
						position: "relative",
					}}
				>
					<IconButton
						onClick={handleWelcomeDialogClose}
						sx={{
							position: "absolute",
							top: 16,
							right: 14,
						}}
					>
						<CloseIcon />
					</IconButton>
					<Typography variant="14-bold">بوردینو</Typography>

					<Box
						display="flex"
						flexDirection="column"
						alignItems="center"
						gap={0.5}
					>
						<EmojiEventsOutlinedIcon
							sx={{
								fontSize: 24,
								color: "#FFA721",
							}}
						/>
						<Typography variant="14-regular" textAlign="center">
							&quot;
							<Typography
								variant="14-regular"
								color="primary.main"
								component="span"
							>
								{username}
							</Typography>
							&quot;&nbsp;به بردینو خوش آمدی!
							<Typography variant="14-regular" textAlign="center" component="p">
								۵۰ امتیاز هدیه گرفتی!
							</Typography>
						</Typography>
					</Box>
					<Button
						variant="contained"
						fullWidth
						onClick={handleWelcomeDialogClose}
						sx={{ borderRadius: "16px", py: "12px", fontWeight: 700 }}
					>
						بزن بریم!
					</Button>
				</Box>
			</Modal>
		</Box>
	);
}
