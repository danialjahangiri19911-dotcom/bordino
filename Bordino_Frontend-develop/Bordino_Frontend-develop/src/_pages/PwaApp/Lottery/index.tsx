"use client";

import { useRouter } from "next/navigation";

import useLottery from "./useLottery";

import { BUY_TICKET } from "@/constants/routes";
import ScoreIconMessage from "@/libs/components/IconMessage/ScoreIconMessage";
import BasicTabs from "@/libs/components/Tabs";
import Button from "@/libs/components/atoms/Button";
import Typography from "@/libs/components/atoms/Typography";
import HomeBigLotteryCountdown from "@/libs/components/common/HomeBigLotteryCountdown";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";

export default function Lottery() {
	const {
		amount,
		lotteryTabs,
		remainingTime,
		allTicket,
		hasBallLength,
		activeLotteries,
	} = useLottery();
	const { push } = useRouter();

	return (
		<PwaAppPageLayout
			sx={{
				mx: 0,
			}}
			rightAction={!!amount && <ScoreIconMessage score={amount} />}
		>
			<HomeBigLotteryCountdown
				giftPrice={120000000}
				remainingTime={remainingTime}
				sx={{ mx: 2 }}
				title={activeLotteries?.name}
				extraContent={
					!!allTicket &&
					!(allTicket === hasBallLength) && (
						<Button
							onClick={() => push(BUY_TICKET.path)}
							sx={(theme) => ({
								backgroundColor: "#FFBA51",
								color: "common.black",
								borderRadius: "0 0 16px 16px ",
								padding: theme.spacing(1.5, 2),
								backgroundImage:
									"linear-gradient(180deg, #FFD391 0%, #FFBA51 93.75%)",
								border: "1px solid #EFB763",
								"&:hover": {
									backgroundColor: "#FFBA51",
								},
								width: "50%",
							})}
						>
							<Typography variant="14-medium" color="text.primary">
								ثبت بلیط بعدی ({`${allTicket} / ${hasBallLength}`})
							</Typography>
						</Button>
					)
				}
			/>
			<BasicTabs
				tabs={lotteryTabs}
				TabSx={{ fontSize: 13, padding: (theme) => theme.spacing(1) }}
				contentSx={(theme) => ({ padding: theme.spacing(3, 2) })}
				variants="standard"
			/>
		</PwaAppPageLayout>
	);
}
