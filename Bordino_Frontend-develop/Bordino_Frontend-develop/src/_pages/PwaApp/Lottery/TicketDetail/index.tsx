"use client";

import { Fragment, useCallback, useMemo } from "react";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import LinearProgress from "@libs/components/atoms/LinearProgress";

import Ball from "@/_pages/PwaApp/Lottery/components/Ball";
import { SelectedBallsRow } from "@/_pages/PwaApp/Lottery/components/BallWithContainer";
import useGetTicketDetail from "@/api/lottery/hooks/useGetTIcketDetail";
import { TICKET_DETAIL as TicketDetailImage } from "@/constants/imagePaths";
import { BUY_TICKET, LOTTERY } from "@/constants/routes";
import ImageBox from "@/libs/components/ImageBox";
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

export default function TicketDetail() {
	const { id } = useParams<{ id: string }>();
	const { push } = useRouter();
	const searchParams = useSearchParams();
	const { data, isLoading } = useGetTicketDetail({ id });

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

	const detailRowData = useMemo(() => {
		if (!data?.result) return [];

		return [
			{
				key: "title",
				value: data.result.name,
			},
			{
				key: "id",
				value: data.result.reference,
			},
			{
				key: "date",
				value: isoStringToString(data.result.update_time, true, true),
			},
		];
	}, [data]);

	const ballNumbers = data?.result?.numbers || [];

	if (isLoading || !data) {
		return null;
	}

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
				<Box
					display="flex"
					flexDirection="column"
					gap={1}
					justifyContent="center"
				>
					<Typography>توپ‌های انتخاب‌شده</Typography>
					<SelectedBallsRow
						sx={{ mx: "auto", flexDirection: "row", width: "95%" }}
					>
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
					{detailRowData.map((row, idx) => (
						<Fragment key={row.key}>
							<DetailRow>
								<Typography color="#3F3F3F" variant="12-regular">
									{transformName[row.key as keyof typeof transformName]}
								</Typography>
								<Typography color="#3F3F3F" variant="12-regular">
									{row.value}
								</Typography>
							</DetailRow>
							{idx < detailRowData.length - 1 && (
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
			<Box
				display="flex"
				flexDirection="column"
				justifyContent="center"
				gap="75px"
			>
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
