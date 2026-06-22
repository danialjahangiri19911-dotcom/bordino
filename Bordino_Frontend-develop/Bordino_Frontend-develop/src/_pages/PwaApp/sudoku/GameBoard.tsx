import React from "react";

import { Cell } from "./Cell";
import { Row, StyledBoard } from "./styles";

import { isPeer } from "@/libs/games/sudoku/generation";
import type { BoardWithMeta, Index } from "@/libs/games/sudoku/types";

interface GameBoardProps {
	board: BoardWithMeta;
	selectedCell: { x: Index; y: Index } | null;
	conflicts: boolean[][];
	onCellClick: (x: Index, y: Index) => void;
}

export function GameBoard({
	board,
	selectedCell,
	conflicts,
	onCellClick,
}: GameBoardProps) {
	const selectedCoords = selectedCell
		? { x: selectedCell.x, y: selectedCell.y }
		: null;
	const selectedValue = selectedCoords
		? board[selectedCoords.x][selectedCoords.y].value
		: null;

	return (
		<StyledBoard elevation={0}>
			{board.map((row, i) => (
				<Row key={i}>
					{row.map((cell, j) => {
						const isSelected =
							selectedCoords?.x === i && selectedCoords?.y === j;
						const peer = selectedCoords
							? isPeer(selectedCoords, { x: i as Index, y: j as Index })
							: false;
						const sameValue = !!(
							selectedValue &&
							cell.value &&
							selectedValue === cell.value
						);
						const conflict = conflicts[i]?.[j] ?? false;
						return (
							<Cell
								key={j}
								cell={cell}
								x={i as Index}
								y={j as Index}
								isSelected={isSelected}
								isPeer={peer}
								sameValue={sameValue}
								conflict={conflict}
								onClick={() => onCellClick(i as Index, j as Index)}
							/>
						);
					})}
				</Row>
			))}
		</StyledBoard>
	);
}
