"use client";

import React from "react";

import { useParams } from "next/navigation";

import Information from "./Information";
import LotteryDetailBanner from "./LotteryDetailBanner";
import MyTickets from "./MyTickets";

import useGetLotteryDetail from "@/api/lottery/hooks/useGetLotteryDetail";
import useGetLotteryFullDetail from "@/api/lottery/hooks/useGetLotteryFullDetail";
import BasicTabs from "@/libs/components/Tabs";
import Box from "@/libs/components/atoms/Box";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import styled from "@/libs/styles/styled";

export default function LotteryDetail() {
	const { id } = useParams<{ id: string }>();

	// اطلاعاتِ پایه (هم برای فعال هم برگزارشده کار می‌کند)
	const { data: detailRes } = useGetLotteryDetail({ id });
	const detail = detailRes?.result;
	const isCompleted = detail?.status === "completed";

	// نتایج (شمارهٔ برنده و جمعِ جایزه) فقط برای قرعه‌کشیِ برگزارشده
	const { data: results } = useGetLotteryFullDetail({
		id,
		enabled: isCompleted,
	});

	if (!detail) return null;

	// برای قرعه‌کشیِ فعال هنوز قرعه کشیده نشده: جایزه = موجودیِ جایزه، بدون توپِ برنده
	const totalPrize = isCompleted
		? (results?.total_prize_pool ?? 0)
		: Number(detail.balance_in_money ?? 0);
	const winnerBall = isCompleted ? (results?.winning_numbers ?? []) : [];

	const lotteryTabs = [
		{
			label: "اطلاعات کلی",
			content: (
				<Information
					total_prize_pool={totalPrize}
					name={detail.name}
					end_date={detail.end_date}
					winnerBall={winnerBall}
				/>
			),
		},
		{
			label: "بلیط‌های من",
			content: <MyTickets lotteryId={id} winningNumbers={winnerBall} />,
		},
		{
			label: "لیست برندگان",
			content: <>لیست برندگان</>,
		},
	];

	return (
		<PwaAppPageLayout sx={{ mx: 0 }}>
			<Wrapper>
				<LotteryDetailBanner
					name={detail.name}
					status={detail.status}
					totalPrize={totalPrize}
				/>
				<BasicTabs
					tabs={lotteryTabs}
					TabSx={{ fontSize: 13, padding: (theme) => theme.spacing(1) }}
					contentSx={(theme) => ({ padding: theme.spacing(3, 2) })}
					variants="standard"
				/>
			</Wrapper>
		</PwaAppPageLayout>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(3),
}));
