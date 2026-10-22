"use client";

import React from "react";

import useButTicket from "./useButTicket";

import Ball from "@/_pages/PwaApp/Lottery/components/Ball";
import { SelectedBallsRow } from "@/_pages/PwaApp/Lottery/components/BallWithContainer";
import Box from "@/libs/components/atoms/Box";
import IconButton from "@/libs/components/atoms/IconButton";
import Snackbar from "@/libs/components/atoms/Snackbar";
import Typography from "@/libs/components/atoms/Typography";
import CloseIcon from "@/libs/components/icons/components/Close";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import Back from "@/libs/components/layouts/PwaAppLayout/customRightActions/Back";
import LoadingButton from "@/libs/components/loading/LoadingButton";
import styled from "@/libs/styles/styled";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

export default function BuyTicket() {
	const {
		snackbarMessage,
		handleCloseSnackbar,
		handleBallClick,
		handleSubmit,
		isSubmitting,
		selectedBalls,
		setSelectedBalls,
		handleBack,
		submitButtonText,
		lotteryTickets,
		handlePrevTicket,
	} = useButTicket();

	return (
		<PwaAppPageLayout
			sx={{
				pt: 2,
				minHeight: "98vh",
				display: "flex",
				flexDirection: "column",
			}}
			rightAction={<Back handleBack={handleBack} />}
		>
			<Container sx={{ flex: 1 }}>
				<Box
					display="flex"
					flexDirection="column"
					width="100%"
					alignItems="center"
					gap={2}
				>
					{" "}
					<Box
						display="flex"
						justifyContent="space-between"
						alignItems="center"
						width="100%"
					>
						<Typography variant="14-medium">
							لطفا شش عدد توپ را انتخاب کنید.
						</Typography>
						{!!lotteryTickets?.result.length && (
							<Typography
								variant="14-medium"
								color="secondary"
								sx={{ cursor: "pointer" }}
								onClick={handlePrevTicket}
							>
								بلیط های قبلی
							</Typography>
						)}
					</Box>
					<BallGrid>
						{[...Array(40)].map((_, i) => {
							const num = i + 1;
							const isSelected = selectedBalls.includes(num);

							const full = selectedBalls.length === 6 && !isSelected;
							// A real button: Tab reaches it, Enter/Space choose it, and its state
							// is announced (aria-pressed).
							return (
								<Box
									key={num}
									component="button"
									type="button"
									aria-label={`توپ ${toPersianDigits(num)}`}
									aria-pressed={isSelected}
									disabled={full}
									onClick={() => handleBallClick(num)}
									sx={{
										p: 0,
										border: 0,
										background: "none",
										borderRadius: "50%",
										cursor: full ? "not-allowed" : "pointer",
										"&:focus-visible": { outline: "2px solid #1976d2", outlineOffset: 2 },
									}}
								>
									<Ball
										num={num}
										ballBackgroundColor={
											isSelected ? "success.dark" : "#FFC43B"
										}
										sx={{
											width: 34,
											height: 34,
											border: isSelected
												? "2px solid #1976d2"
												: "2px solid #CDCDCD",
											transition: "border 0.2s",
										}}
										ballInnerSx={{ width: 19, height: 19, fontSize: 13 }}
									/>
								</Box>
							);
						})}
					</BallGrid>
				</Box>

				<Box
					display="flex"
					flexDirection="column"
					width="100%"
					alignItems="center"
					gap={4}
				>
					<Box display="flex" flexDirection="column" gap={1} width="95%">
						<Typography variant="12-regular">توپ‌های انتخاب‌شده</Typography>
						<SelectedBallsRow>
							{Array.from({ length: 6 }).map((_, idx) => {
								const ballNum = selectedBalls[idx];
								return (
									<Box
										key={idx}
										sx={{
											position: "relative",
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
										}}
									>
										{!!ballNum && (
											<IconButton
												size="small"
												onClick={() =>
													setSelectedBalls(
														selectedBalls.filter((n) => n !== ballNum),
													)
												}
												sx={{
													position: "absolute",
													top: -4,
													right: -10,
													zIndex: 2,
													color: "#d32f2f",
													background: "#fff",
													borderRadius: "50%",
													width: 20,
													height: 20,
													boxShadow: "0 1px 4px #0002",
												}}
											>
												<CloseIcon fontSize="small" />
											</IconButton>
										)}
										<Ball
											num={ballNum ?? "?"}
											ballBackgroundColor={ballNum ? "#1976d2" : "#6D6E71"}
											sx={{
												width: 40,
												height: 40,
											}}
										/>
									</Box>
								);
							})}
						</SelectedBallsRow>
					</Box>

					<LoadingButton
						variant="contained"
						fullWidth
						color="secondary"
						isLoading={isSubmitting}
						disabled={selectedBalls.length !== 6 || isSubmitting}
						onClick={handleSubmit}
					>
						{submitButtonText}
					</LoadingButton>
				</Box>

				<Snackbar
					open={!!snackbarMessage}
					message={snackbarMessage ?? ""}
					severity="error"
					onClose={handleCloseSnackbar}
				/>
			</Container>
		</PwaAppPageLayout>
	);
}

const Container = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(3),
	width: "100%",
	padding: theme.spacing(2, 0),
	justifyContent: "space-between",
	height: "85vh",
}));

const BallGrid = styled(Box)(({ theme }) => ({
	display: "grid",
	gridTemplateColumns: "repeat(8, 1fr)",
	gap: theme.spacing(1),
	padding: theme.spacing(2),
	borderRadius: 16,
	width: "90%",
	border: "1px solid #6D6E71",
	direction: "rtl",
	background: "#fafbfc",
	boxShadow: "0 2px 12px #0001",
	margin: "0 auto",
	[theme.breakpoints.down("sm")]: {
		gridTemplateColumns: "repeat(6, 1fr)",
	},
}));
