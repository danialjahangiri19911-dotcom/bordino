import React, { Fragment } from "react";

import { useRouter } from "next/navigation";

import TicketComponent from "./Ticket";

import { LotteryContentWrapper } from "@/_pages/PwaApp/Lottery/styledComponents";
import type { LotteryTicketsApiResponse } from "@/api/lottery/types/getLotteryTickets";
import { TICKET_DETAIL } from "@/constants/routes";
import { type BoxProps } from "@/libs/components/atoms/Box";
import Divider from "@/libs/components/atoms/Divider";
import Typography from "@/libs/components/atoms/Typography";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props {
	ballSx?: BoxProps["sx"];
	sx?: BoxProps["sx"];
	data?: LotteryTicketsApiResponse;
}

export default function RenderActiveTickets({
	ballSx,
	sx,
	data,
}: Readonly<Props>) {
	const { push } = useRouter();

	return (
		<LotteryContentWrapper sx={sx}>
			{!!data?.result.length && (
				<>
					<Typography variant="12-regular">لیست بلیط‌ها</Typography> <Divider />
				</>
			)}

			{data?.result?.map((ticket, index, array) => (
				<Fragment key={ticket.id}>
					<TicketComponent
						ticketNumber={array.length - index}
						ballsNumber={ticket.numbers}
						ballSx={ballSx}
						onShowDetails={() => {
							push(
								addParamsToUrl(TICKET_DETAIL.path, {
									id: ticket.id,
								}),
							);
						}}
					/>
					{index < array.length - 1 && (
						<Divider
							orientation="horizontal"
							flexItem
							sx={{ mx: 1 / 4, borderColor: "#e0e0e0" }}
						/>
					)}
				</Fragment>
			))}
		</LotteryContentWrapper>
	);
}
