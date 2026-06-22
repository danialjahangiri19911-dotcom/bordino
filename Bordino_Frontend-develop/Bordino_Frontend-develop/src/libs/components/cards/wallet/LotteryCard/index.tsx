import { memo, useCallback } from "react";

import Box from "@libs/components/atoms/Box";
import Chip from "@libs/components/atoms/Chip";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import TicketIconImage from "@/libs/components/IconMessage/TicketIconImage";
import ImageBox from "@/libs/components/ImageBox";
import IconButton from "@/libs/components/atoms/IconButton";
import ArrowBackIo from "@/libs/components/icons/components/ArrowBackIo";

interface Props {
	image: string;
	title: string;
	date: string;
	dateLabel?: string;
	deprecated?: boolean;
	onAction: () => void;
	ticketCount?: number;
}

function LotteryCard({
	date,
	dateLabel = "زمان برگزاری",
	image,
	title,
	deprecated = false,
	onAction,
	ticketCount,
}: Readonly<Props>) {
	const renderStatus = useCallback(() => {
		if (deprecated) {
			return <Chip label="برگزار شده" />;
		}
		if (ticketCount) {
			return <TicketIconImage ticket={ticketCount} />;
		}
		return null;
	}, [deprecated, ticketCount]);

	return (
		<LotteryCardWrapper>
			<Box display="flex" gap={2} alignItems="center" flexGrow={1}>
				<ImageBox
					src={image}
					alt="Lottery-image"
					width={64}
					height={64}
					sx={{ borderRadius: 1, border: `1px solid #B4ABAB`, flexShrink: 0 }}
				/>
				<Box display="flex" flexDirection="column" gap={1} flexGrow={1}>
					<DetailWrapper>
						<Box display="flex" alignItems="center" gap={1}>
							{renderStatus() && renderStatus()}
							<Typography variant="14-regular" color="#2F2F2F">
								{title}
							</Typography>
						</Box>

						{deprecated && (
							<IconButton onClick={onAction}>
								<ArrowBackIo fontSize="small" />
							</IconButton>
						)}
					</DetailWrapper>
					<DetailWrapper>
						<Typography variant="12-medium" color="#878686">
							{dateLabel + " : "}
							{date}
						</Typography>
					</DetailWrapper>
				</Box>
			</Box>
		</LotteryCardWrapper>
	);
}

export default memo(LotteryCard);

const LotteryCardWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	gap: theme.spacing(2),
	alignItems: "center",
	position: "relative",
}));
const DetailWrapper = styled(Box)(() => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
}));
