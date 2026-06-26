"use client";

import { Fragment, useState } from "react";

import type { LotteryMatchGroup } from "@/api/lottery/types/getLotteryFullDetailType";
import { DEFAULT_IMAGE } from "@/constants/imagePaths";
import WinnerDetailDrawer from "@/libs/components/Drawer/WinnerDetailDrawer";
import ImageBox from "@/libs/components/ImageBox";
import Box from "@/libs/components/atoms/Box";
import Typography from "@/libs/components/atoms/Typography";
import ArrowBackIo from "@/libs/components/icons/components/ArrowBackIo";
import styled from "@/libs/styles/styled";

interface Props {
	groups?: LotteryMatchGroup[];
	/** برای واکشیِ جزئیاتِ برنده در drawer */
	lotteryId?: string;
}

/** برچسبِ ردیفِ تطبیق مطابق فیگما: ۶ توپ → «جکپات»، در غیر این صورت «N توپ درست» */
function tierLabel(matched: number): string {
	return matched >= 6 ? "جکپات" : `${matched} توپ درست`;
}

const formatToman = (value: number | string) =>
	`${Number(value || 0).toLocaleString("en-US")} تومان`;

export default function WinnersList({
	groups = [],
	lotteryId,
}: Readonly<Props>) {
	const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

	if (!groups.length) {
		return (
			<Typography
				color="text.secondary"
				textAlign="center"
				sx={{ py: 4, fontSize: 14 }}
			>
				هنوز برنده‌ای برای این قرعه‌کشی ثبت نشده است.
			</Typography>
		);
	}

	return (
		<Box display="flex" flexDirection="column" gap={1.5}>
			{groups.map((group, groupIdx) => (
				<Fragment key={group.matched_numbers}>
					<Box display="flex" flexDirection="column" gap={2}>
						<Typography variant="12-regular" color="#3F3F3F">
							{tierLabel(group.matched_numbers)}
						</Typography>

						{group.winners.map((winner, winnerIdx) => (
							<Row
								key={`${winner.customer_id}-${winnerIdx}`}
								role="button"
								onClick={() => setSelectedWinnerId(winner.customer_id)}
								sx={{ cursor: "pointer" }}
							>
								<Identity>
									<ImageBox
										src={winner.avatar || DEFAULT_IMAGE}
										alt={winner.username || ""}
										width={32}
										height={32}
										sx={{ borderRadius: "50%", flexShrink: 0 }}
									/>
									<Typography variant="14-medium" color="#3C3C3C">
										{winner.username || "—"}
									</Typography>
								</Identity>

								<Prize>
									<Typography variant="14-medium" color="#3C3C3C">
										{formatToman(winner.prize_amount)}
									</Typography>
									<ArrowBackIo sx={{ fontSize: 18, color: "#9A9A9A" }} />
								</Prize>
							</Row>
						))}
					</Box>

					{groupIdx < groups.length - 1 && <GroupDivider />}
				</Fragment>
			))}

			<WinnerDetailDrawer
				open={!!selectedWinnerId}
				onClose={() => setSelectedWinnerId(null)}
				lotteryId={lotteryId}
				winnerId={selectedWinnerId ?? undefined}
			/>
		</Box>
	);
}

const Row = styled(Box)({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	justifyContent: "space-between",
});

const Identity = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	gap: theme.spacing(1),
}));

const Prize = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	gap: theme.spacing(1.5),
}));

const GroupDivider = styled(Box)({
	borderTop: "1px solid #E5E5E5",
	width: "100%",
});
