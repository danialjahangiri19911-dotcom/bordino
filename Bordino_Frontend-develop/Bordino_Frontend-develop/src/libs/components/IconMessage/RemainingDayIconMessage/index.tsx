import { memo } from "react";

import BaseIconMessage from "@libs/components/IconMessage/BaseIconMessage";
import type { BaseIconMessageProps } from "@libs/components/IconMessage/interfaces";

interface Props {
	remainingDay: BaseIconMessageProps["message"];
}

function RemainingDayIconMessage({ remainingDay }: Readonly<Props>) {
	return (
		<BaseIconMessage
			lastIcon="❄️"
			messagePrefix="روز"
			message={remainingDay}
			backgroundColor="secondary.600"
			color="common.white"
		/>
	);
}

export default memo(RemainingDayIconMessage);
