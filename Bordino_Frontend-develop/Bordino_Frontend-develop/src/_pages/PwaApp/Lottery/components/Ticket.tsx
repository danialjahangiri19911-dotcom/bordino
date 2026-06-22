import { Fragment, memo } from "react";

import Ball from "./Ball";
import ImageBox from "@libs/components/ImageBox";
import Box, { type BoxProps } from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import { TICKET_V2 } from "@/constants/imagePaths";

interface Props {
	ballsNumber: number[];
	ticketNumber: number;
	ballSx?: BoxProps["sx"];
	onShowDetails?: () => void;
}

function TicketComponent({
	ballsNumber,
	ticketNumber,
	ballSx,
	onShowDetails,
}: Readonly<Props>) {
	return (
		<TicketWrapper>
			<TicketNumberBox>
				<Typography variant="14-medium">بلیط شماره {ticketNumber}</Typography>
				<ImageBox
					src={TICKET_V2}
					width={18}
					height={22}
					alt="ticket"
					sx={{ ml: 0.5 }}
				/>
			</TicketNumberBox>
			<Header>
				{!!ballsNumber?.length && (
					<Typography
						sx={{ cursor: "pointer" }}
						onClick={onShowDetails}
						variant="14-regular"
						color="#444"
					>
						جزئیات
					</Typography>
				)}
			</Header>
			{ballsNumber?.length ? (
				<BallsRow>
					{ballsNumber?.map((num, idx) => (
						<Fragment key={`${num}-${idx}`}>
							<Ball
								sx={ballSx}
								num={num}
								ballBackgroundColor="rgba(39, 170, 225, 1)"
							/>
							{idx !== ballsNumber.length - 1 && (
								<Divider
									orientation="vertical"
									flexItem
									sx={{ mx: 1 / 4, borderColor: "#e0e0e0" }}
								/>
							)}
						</Fragment>
					))}
				</BallsRow>
			) : (
				<Typography textAlign="center" variant="14-regular" color="#444">
					توپی انتخاب نشده
				</Typography>
			)}
		</TicketWrapper>
	);
}

export default memo(TicketComponent);

const TicketWrapper = styled(Box)(({ theme }) => ({
	background: "#fdf6ec",
	borderRadius: theme.shape.borderRadius * 2,
	border: "1px solid #ececec",
	padding: theme.spacing(2, 1.5, 2, 1.5),
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	boxShadow: "0 1px 2px #0001",
	position: "relative",
}));

const Header = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	marginBottom: theme.spacing(2),
}));

const TicketNumberBox = styled(Box)(({ theme }) => ({
	background: "#fff",
	borderRadius: theme.shape.borderRadius * 2,
	borderTopLeftRadius: 0,
	borderTopRightRadius: 0,
	padding: theme.spacing(0.5, 3),
	fontWeight: 500,
	fontSize: 18,
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
	boxShadow: "0 1px 2px #0001",
	position: "absolute",
	left: "50%",
	top: -1,
	transform: "translateX(-50%)",
	zIndex: 2,
}));

const BallsRow = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: theme.spacing(1 / 2),
}));
