import { memo } from "react";

import type { BoxProps } from "@libs/components/atoms/Box";
import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import LinearProgress, {
	linearProgressClasses,
} from "@libs/components/atoms/LinearProgress";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import { TICKET_V2 } from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";
import Button from "@/libs/components/atoms/Button";

////TODO:why color does not exist in theme?

interface Props {
	points: number | string;
	title: string;
	image: string;
	capacity?: number;
	handleExchange: () => void;
	ticketCount: number;
	sx?: BoxProps["sx"];
}

function PointsBag({
	image,
	points,
	title,
	capacity = 100,
	handleExchange,
	sx,
	ticketCount,
}: Readonly<Props>) {
	return (
		<PointsBagWrapper sx={sx}>
			<CardInfo>
				<CardItemWrapper>
					<ImageBox src={image} width={32} />
					<Typography variant="14-medium">{title}</Typography>
				</CardItemWrapper>
				<CardItemWrapper>
					<CardItemWrapper gap={1 / 2}>
						<ImageBox src={image} sx={{ borderRadius: "50%" }} width={14} />
						<Typography variant="12-regular">{points} امتیاز</Typography>
					</CardItemWrapper>
					<Divider
						orientation="vertical"
						sx={{
							height: 16,
						}}
					/>
					<CardItemWrapper gap={1 / 2}>
						<ImageBox src={TICKET_V2} sx={{ borderRadius: "50%" }} width={14} />
						<Typography variant="12-regular">{ticketCount} بلیط</Typography>
					</CardItemWrapper>
				</CardItemWrapper>
			</CardInfo>

			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="11-regular">{points} امتیاز</Typography>
					<Typography variant="11-regular">{capacity} امتیاز</Typography>
				</Box>
				<BorderLinearProgress
					variant="determinate"
					value={+points > 100 ? 100 : +points}
				/>
			</Box>

			<Box display="flex" justifyContent="center">
				<Button
					sx={(theme) => ({
						backgroundColor: "#FFBA51",
						width: "max-content",
						p: theme.spacing(1 / 2, 6),
						borderTopLeftRadius: theme.shape.borderRadius * 4,
						borderTopRightRadius: theme.shape.borderRadius * 4,
						borderBottomLeftRadius: 0,
						borderBottomRightRadiusRadius: 0,
						backgroundImage:
							"linear-gradient(180deg, #FFD391 0%, #FFBA51 93.75%)",
						border: "1px solid #EFB763",
						color: "common.black",
					})}
					onClick={handleExchange}
				>
					تبدیل امتیاز به بلیط
				</Button>
			</Box>
		</PointsBagWrapper>
	);
}

export default memo(PointsBag);

const PointsBagWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	padding: theme.spacing(2, 2.5),
	paddingBottom: 0,
	borderRadius: theme.shape.borderRadius * 4,
	border: `1px solid #F1B9B9`,
	backgroundColor: theme.palette.primary["50"],
	position: "relative",
	gap: theme.spacing(2),
}));

const CardInfo = styled(Box)(() => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
}));

const CardItemWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
}));

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
	height: 16,
	borderRadius: 40,
	border: `1px solid #F1B9B9`,

	[`&.${linearProgressClasses.colorPrimary}`]: {
		backgroundColor: theme.palette.grey[200],
	},
	[`& .${linearProgressClasses.bar}`]: {
		borderRadius: 5,
		backgroundColor: theme.palette.primary[500],
	},
}));
