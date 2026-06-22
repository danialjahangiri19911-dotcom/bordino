"use client";

import { useMemo } from "react";

import useHomeData from "./useHomeData";
import Box from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

import { LOGO_ADDRESS } from "@/constants/imagePaths";
import ImageText from "@/libs/components/ImageText";
import Puzzle from "@/libs/components/games/Puzzle";
import LuckyWheel from "@/libs/components/games/Roulette";

export default function Home() {
	const { homeData } = useHomeData();

	const renderComponents = useMemo(
		() =>
			homeData.map((item, index) => (
				<ImageText
					key={item.title}
					sx={{
						justifyContent: "space-around",
						flexDirection: index % 2 === 0 ? "row" : "row-reverse",
					}}
					content={item.content}
					title={item.title}
					titleProps={item.titleProps}
					src={item.src}
					imageSx={{
						width: { xs: 300, md: 400, lg: 470 },
						height: { xs: 330, md: 370, lg: 436 },
					}}
				/>
			)),
		[homeData],
	);
	return (
		<Wrapper>
			<WheelWrapper>
				<LuckyWheel items={[{ option: "جایزه ۱" }, { option: "پوچ" }]} />
			</WheelWrapper>
			<Puzzle onComplete={() => alert("complete")} imageUrl={LOGO_ADDRESS} />
			{renderComponents}
		</Wrapper>
	);
}
const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(15),
}));
const WheelWrapper = styled(Box)({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	padding: "20px",
});
