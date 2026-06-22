import React from "react";

import { NumberControl } from "./NumberControl";
import { NumberPadContainer } from "./styles";

import { range } from "@/libs/games/sudoku/generation";

interface NumberPadProps {
	numberProgress: number[];
	selectedCoords: { x: number; y: number } | null;
	board: any; // BoardWithMeta
	status: string;
	onNumberClick: (num: number) => void;
	onNumberDoubleClick: (num: number) => void;
}

export function NumberPad({
	numberProgress,
	selectedCoords,
	board,
	status,
	onNumberClick,
	onNumberDoubleClick,
}: NumberPadProps) {
	return (
		<NumberPadContainer>
			{range(9).map((i) => {
				const num = i + 1;
				const disabled =
					!selectedCoords ||
					board[selectedCoords.x][selectedCoords.y].prefilled ||
					status !== "playing";
				return (
					<NumberControl
						key={num}
						number={num}
						completion={numberProgress[num] / 9}
						onClick={() => !disabled && onNumberClick(num)}
						onDoubleClick={() => !disabled && onNumberDoubleClick(num)}
						disabled={disabled}
					/>
				);
			})}
		</NumberPadContainer>
	);
}
