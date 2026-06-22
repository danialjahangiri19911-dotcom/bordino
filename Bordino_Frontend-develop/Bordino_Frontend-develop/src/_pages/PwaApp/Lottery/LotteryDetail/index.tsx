"use client";

import React from "react";

import { useParams } from "next/navigation";

import Information from "./Information";
import LotteryDetailBanner from "./LotteryDetailBanner";

import useGetLotteryFullDetail from "@/api/lottery/hooks/useGetLotteryFullDetail";
import BasicTabs from "@/libs/components/Tabs";
import Box from "@/libs/components/atoms/Box";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import styled from "@/libs/styles/styled";

export default function LotteryDetail() {
	const { id } = useParams<{ id: string }>();
	const { data } = useGetLotteryFullDetail({
		id,
	});

	if (!data) return null;

	const lotteryTabs = [
		{
			label: "اطلاعات کلی",
			content: (
				<Information
					total_prize_pool={data.total_prize_pool}
					name={data.name}
					end_date={data.end_date}
					winnerBall={data.winning_numbers}
				/>
			),
		},
		{
			label: "بلیط‌های من",
			content: <>بلیط‌های من</>,
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
					name={data.name}
					status={data.status}
					totalPrize={data.total_prize_pool}
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
