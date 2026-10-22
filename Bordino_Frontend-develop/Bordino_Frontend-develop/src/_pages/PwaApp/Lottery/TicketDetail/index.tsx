"use client";

import { Fragment, useCallback, useMemo } from "react";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import LinearProgress from "@libs/components/atoms/LinearProgress";

import Ball from "@/_pages/PwaApp/Lottery/components/Ball";
import BilliardBall from "@/_pages/PwaApp/Lottery/components/BilliardBall";
import { SelectedBallsRow } from "@/_pages/PwaApp/Lottery/components/BallWithContainer";
import useGetTicketDetail from "@/api/lottery/hooks/useGetTIcketDetail";
import { TICKET_DETAIL as TicketDetailImage } from "@/constants/imagePaths";
import { BUY_TICKET, LOTTERY } from "@/constants/routes";
import ImageBox from "@/libs/components/ImageBox";
import LoadState from "@/libs/components/common/LoadState";
import Box from "@/libs/components/atoms/Box";
import Button from "@/libs/components/atoms/Button";
import Divider from "@/libs/components/atoms/Divider";
import Typography from "@/libs/components/atoms/Typography";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import styled from "@/libs/styles/styled";
import { isoStringToString } from "@/libs/utils/date";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

const transformName = {
	title: "عنوان بلیط",
	id: "شناسه بلیط",
	date: "تاریخ و ساعت",
};

const NUM_WORDS = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش"];

/** متنِ ردیفِ «وضعیت» مطابق فیگما، بر اساس وضعیتِ قرعه‌کشی و تعداد توپِ منطبق */
function buildStatusText(
	lotteryStatus?: string,
	matchedCount?: number | null,
): string {
	if (lotteryStatus === "completed") {
		const c = matchedCount ?? 0;
		if (c <= 0) return "برگزار شده - بدون توپ مشابه";
		const word = NUM_WORDS[c] ?? String(c);
		return `برگزار شده - ${word} توپ شما مشابه`;
	}
	if (lotteryStatus === "cancelled") return "لغو شده";
	return "در حال برگزاری";
}

export default function TicketDetail() {
	const { id } = useParams<{ id: string }>();
	const { push, back } = useRouter();
	const searchParams = useSearchParams();
	const { data, isLoading, error, refetch } = useGetTicketDetail({ id });

	// این صفحه دو حالت دارد:
	//  - جریانِ خرید (وقتی پارامترِ count در URL هست): نوار پیشرفت و دکمهٔ «ثبت بلیط بعدی»
	//  - مشاهدهٔ بلیطِ خریداری‌شده (از «بلیط‌های من»): طراحیِ فیگما (node 881-19957)
	const isBuyFlow = searchParams.has("count");

	// Progress within the current purchase session, carried via the URL:
	// "count" = total tickets chosen, "done" = how many are already completed.
	const ticketCount = Math.max(1, Number(searchParams.get("count")) || 1);
	const assignCount = Math.max(0, Number(searchParams.get("done")) || 0);
	const isFinished = assignCount >= ticketCount;

	const actionButtonOnClick = useCallback(() => {
		if (isFinished) {
			push(LOTTERY.path);
		} else {
			push(
				addSearchParamsToUrl(BUY_TICKET.path, {
					count: String(ticketCount),
					done: String(assignCount),
				}),
			);
		}
	}, [isFinished, assignCount, ticketCount, push]);

	const actionButtonText = useMemo(() => {
		if (isFinished) {
			return "خروج";
		}
		return `ثبت بلیط بعدی ${assignCount + 1}/${ticketCount}`;
	}, [isFinished, assignCount, ticketCount]);

	const ballNumbers = data?.result?.numbers || [];

	if (isLoading || !data) {
		return (
			<PwaAppPageLayout>
				<LoadState loading={isLoading || !error} error={error} onRetry={() => refetch()} />
			</PwaAppPageLayout>
		);
	}

	// ───────────────────────── حالتِ مشاهده (فیگما) ─────────────────────────
	if (!isBuyFlow) {
		const result = data.result;
		const winningNumbers = result?.winning_numbers ?? [];
		const ticketNo = searchParams.get("n");

		const detailRows = [
			{ key: "title", label: "عنوان بلیط", value: result?.name },
			{
				key: "date",
				label: "تاریخ و ساعت",
				value: isoStringToString(result?.update_time, true, true),
			},
			{ key: "id", label: "شناسه بلیط", value: result?.reference },
			{
				key: "status",
				label: "وضعیت:",
				value: buildStatusText(result?.lottery_status, result?.matched_count),
			},
		];

		return (
			<PwaAppPageLayout
				contentWrapperProps={{
					sx: {
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						height: "95dvh",
					},
				}}
				hasHeader={false}
			>
				<Wrapper>
					<Typography variant="14-medium" color="#151414">
						{ticketNo ? `اطلاعات بلیط شماره ${ticketNo}` : "اطلاعات بلیط"}
					</Typography>

					<Box display="flex" flexDirection="column" gap={1}>
						<Typography variant="12-regular" color="#3F3F3F">
							توپ‌های انتخاب‌شده
						</Typography>
						<BallsCard>
							{ballNumbers.length ? (
								ballNumbers.map((number, idx) => (
									<Fragment key={`${number}-${idx}`}>
										<BilliardBall
											num={number}
											matched={winningNumbers.includes(number)}
										/>
										{idx < ballNumbers.length - 1 && <BallDivider />}
									</Fragment>
								))
							) : (
								<Typography variant="12-regular" color="#3F3F3F">
									توپی انتخاب نشده است.
								</Typography>
							)}
						</BallsCard>
					</Box>

					<Box display="flex" flexDirection="column" gap={1.5}>
						{detailRows.map((row, idx) => (
							<Fragment key={row.key}>
								<DetailRow>
									<Typography color="#3F3F3F" variant="12-regular">
										{row.label}
									</Typography>
									<Typography color="#3F3F3F" variant="12-regular">
										{row.value}
									</Typography>
								</DetailRow>
								{idx < detailRows.length - 1 && <DottedDivider />}
							</Fragment>
						))}
					</Box>
				</Wrapper>

				<Box display="flex" flexDirection="column" gap={3}>
					<ImageBox
						src={TicketDetailImage}
						alt="ticket-detail"
						sx={{
							width: "60%",
							maxWidth: 250,
							aspectRatio: "250 / 210",
							mx: "auto",
						}}
					/>
					<Button
						onClick={() => back()}
						fullWidth
						variant="outlined"
						sx={{
							borderWidth: 1.5,
							borderColor: "#313E72",
							color: "#313E72",
							"&:hover": { borderColor: "#313E72", borderWidth: 1.5 },
						}}
					>
						<Typography variant="16-medium" color="#313E72">
							خروج
						</Typography>
					</Button>
				</Box>
			</PwaAppPageLayout>
		);
	}

	// ───────────────────────── حالتِ خرید (بدون تغییر) ─────────────────────────
	return (
		<PwaAppPageLayout
			contentWrapperProps={{
				sx: {
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					height: "95dvh",
				},
			}}
			hasHeader={false}
		>
			<Wrapper>
				<ProgressBar
					variant="determinate"
					value={(assignCount / ticketCount) * 100}
					sx={{
						width: "100%",
						"& .MuiLinearProgress-bar": {
							borderRadius: "0 39px 39px 0",
						},
					}}
				/>
				<Typography variant="20-medium" mt={2} color="common.black">
					{` اطلاعات بلیط شماره ${assignCount || ""}`}
				</Typography>
				<Box display="flex" flexDirection="column" gap={1} justifyContent="center">
					<Typography>توپ‌های انتخاب‌شده</Typography>
					<SelectedBallsRow sx={{ mx: "auto", flexDirection: "row", width: "95%" }}>
						{ballNumbers.length
							? ballNumbers.map((number) => (
									<Ball
										key={number}
										num={number}
										ballBackgroundColor="rgba(39, 170, 225, 1)"
										sx={{ width: "40px", height: "40px" }}
									/>
								))
							: "توپی انتخاب نشده است."}
					</SelectedBallsRow>
				</Box>
				<Box display="flex" flexDirection="column" gap={1}>
					{[
						{ key: "title", value: data.result.name },
						{ key: "id", value: data.result.reference },
						{
							key: "date",
							value: isoStringToString(data.result.update_time, true, true),
						},
					].map((row, idx, arr) => (
						<Fragment key={row.key}>
							<DetailRow>
								<Typography color="#3F3F3F" variant="12-regular">
									{transformName[row.key as keyof typeof transformName]}
								</Typography>
								<Typography color="#3F3F3F" variant="12-regular">
									{row.value}
								</Typography>
							</DetailRow>
							{idx < arr.length - 1 && (
								<Divider
									sx={{
										borderStyle: "dotted",
										borderColor: "#E0E0E0",
										borderWidth: "3px 0 0 0",
										width: "100%",
										my: 0.5,
									}}
								/>
							)}
						</Fragment>
					))}
				</Box>
			</Wrapper>
			<Box display="flex" flexDirection="column" justifyContent="center" gap="75px">
				<ImageBox
					src={TicketDetailImage}
					alt="ticket-detail"
					sx={{ width: "60%", maxWidth: 250, aspectRatio: "250 / 210", mx: "auto" }}
				/>
				<Box display="flex" gap={2}>
					<Button
						onClick={actionButtonOnClick}
						fullWidth
						color="secondary"
						sx={{ borderWidth: 2 }}
						variant={actionButtonText === "خروج" ? "outlined" : "contained"}
					>
						<Typography variant="14-medium"> {actionButtonText}</Typography>
					</Button>
					{!isFinished && (
						<Button
							onClick={() => push(LOTTERY.path)}
							fullWidth
							variant="outlined"
							color="secondary"
							sx={{ borderWidth: 2 }}
						>
							<Typography variant="14-medium"> خروج</Typography>
						</Button>
					)}
				</Box>
			</Box>
		</PwaAppPageLayout>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2.5),
	marginTop: theme.spacing(3),
}));

const DetailRow = styled(Box)(() => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
}));

const BallsCard = styled(Box)({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	justifyContent: "space-between",
	backgroundColor: "#fff",
	border: "1px solid #898989",
	borderRadius: 8,
	padding: 12,
});

const BallDivider = styled(Box)({
	width: "1px",
	height: 19,
	backgroundColor: "#CACACA",
	flexShrink: 0,
});

const DottedDivider = styled(Box)({
	borderTop: "1px dotted #CACACA",
	width: "100%",
});

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
	height: 16,
	borderRadius: 39,
	rotate: "180deg",
	backgroundColor: theme.palette.grey[200],
	"& .MuiLinearProgress-bar": {
		borderRadius: 39,
		backgroundColor: "rgba(35, 87, 137, 1)",
	},
}));
