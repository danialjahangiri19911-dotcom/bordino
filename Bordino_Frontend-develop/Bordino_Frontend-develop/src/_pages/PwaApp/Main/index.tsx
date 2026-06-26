"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import DailyTasks from "./DailyTasks";
import PromoCarousel from "./PromoCarousel";
import { DAILY_TASKS_MOCK_DATA, SPECIAL_CHALLENGE } from "./mockData";
import Stack from "@mui/material/Stack";
import HafezDrawer from "@pages/PwaApp/Hafez/HafezDrawer";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import { LOTTERY_GUIDE } from "@/constants/routes";
import Box from "@/libs/components/atoms/Box";
import HomeBigLotteryCountdown from "@/libs/components/common/HomeBigLotteryCountdown";
import PointsChip from "@/libs/components/common/PointsChip";
import StreakDaysChip from "@/libs/components/common/StreakDaysChip";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import useUserStore from "@/libs/stores/userStore";

export default function Main() {
	const { remainingTime, activeLotteries } = useExtractLotteries();
	const { user } = useUserStore();
	const { push } = useRouter();
	const [hafezOpen, setHafezOpen] = useState(false);

	// useEffect(() => {
	// 	if (user?.registrationStep === "ProfileSetup") {
	// 		push(ONBOARDING.path);
	// 	}
	// }, [push, user?.registrationStep]);

	return (
		<PwaAppPageLayout
			sx={{ mx: 0 }}
			rightAction={
				<Box display="flex" alignItems="center" gap={1}>
					<PointsChip />
					<StreakDaysChip />
				</Box>
			}
		>
			<Stack rowGap="32px" mx="16px">
				<HomeBigLotteryCountdown
					giftPrice={Number(activeLotteries?.balance_in_money ?? 0)}
					onShowDetails={() => push(LOTTERY_GUIDE.path)}
					remainingTime={remainingTime}
				/>

				<DailyTasks tasks={DAILY_TASKS_MOCK_DATA} />

				<PromoCarousel onHafezClick={() => setHafezOpen(true)} />

				<DailyTasks
					tasks={SPECIAL_CHALLENGE}
					extraContent="72 ساعت تا اتمام"
					title="چالش ویژه 🔥"
				/>
			</Stack>
			<HafezDrawer open={hafezOpen} onClose={() => setHafezOpen(false)} />
		</PwaAppPageLayout>
	);
}
