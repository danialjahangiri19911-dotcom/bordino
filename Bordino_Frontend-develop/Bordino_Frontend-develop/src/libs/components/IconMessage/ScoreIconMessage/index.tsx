import { memo } from "react";

import BaseIconMessage from "@libs/components/IconMessage/BaseIconMessage";
import type { BaseIconMessageProps } from "@libs/components/IconMessage/interfaces";

import { SCORE } from "@/constants/imagePaths";

interface Props {
	score: BaseIconMessageProps["message"];
}

function ScoreIconMessage({ score }: Readonly<Props>) {
	return (
		<BaseIconMessage
			firstIcon={SCORE}
			messagePrefix="امتیاز"
			message={score}
			backgroundColor="primary.50"
			color="primary.600"
		/>
	);
}

export default memo(ScoreIconMessage);
