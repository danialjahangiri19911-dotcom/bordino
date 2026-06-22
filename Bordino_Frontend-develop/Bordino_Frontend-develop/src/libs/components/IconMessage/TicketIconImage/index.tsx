import { memo } from "react";

import BaseIconMessage from "@libs/components/IconMessage/BaseIconMessage";
import type { BaseIconMessageProps } from "@libs/components/IconMessage/interfaces";

import { TICKET } from "@/constants/imagePaths";

interface Props {
	ticket: BaseIconMessageProps["message"];
}

function TicketIconMessage({ ticket }: Readonly<Props>) {
	return (
		<BaseIconMessage
			firstIcon={TICKET}
			messagePrefix="بلیط داری"
			message={ticket}
			backgroundColor="#EAF3FF"
			color="#3E55DC"
		/>
	);
}

export default memo(TicketIconMessage);
