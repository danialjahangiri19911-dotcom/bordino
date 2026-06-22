import React from "react";

import { CircularProgress } from "./CircularProgress";
import { NumberButton } from "./styles";

export interface NumberControlProps {
	number: number;
	completion: number;
	onClick?: () => void;
	onDoubleClick?: () => void;
	disabled?: boolean;
}

export function NumberControl({
	number,
	completion,
	onClick,
	onDoubleClick,
	disabled,
}: NumberControlProps) {
	return (
		<NumberButton
			disabled={disabled}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		>
			<div>{number}</div>
			<CircularProgress percent={completion} />
		</NumberButton>
	);
}
