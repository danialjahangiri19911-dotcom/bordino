import React from "react";

import { CellButton, NoteGrid, NoteNumber } from "./styles";

import { toFa } from "@/libs/games/sudoku/faDigits";
import { range } from "@/libs/games/sudoku/generation";
import {
	ControlNumberColor,
	DeepOrange200,
	DeepOrange600,
	LightBlue100,
	LightBlue200,
	LightBlue300,
} from "@/libs/games/sudoku/theme";
import type { CellMeta, CellValue, Index } from "@/libs/games/sudoku/types";

export interface CellComponentProps {
	cell: CellMeta;
	x: Index;
	y: Index;
	isSelected: boolean;
	isPeer: boolean;
	sameValue: boolean;
	conflict: boolean;
	onClick: () => void;
}

export function Cell({
	cell,
	isSelected,
	isPeer,
	sameValue,
	conflict,
	onClick,
}: CellComponentProps) {
	const { value, prefilled, notes } = cell;
	let backgroundColor = "initial";
	if (conflict && isPeer && sameValue) backgroundColor = DeepOrange200;
	else if (sameValue) backgroundColor = LightBlue300;
	else if (isSelected) backgroundColor = LightBlue200;
	else if (isPeer) backgroundColor = LightBlue100;

	let color = "initial";
	if (conflict && !prefilled) color = DeepOrange600;
	else if (!prefilled && value) color = ControlNumberColor;

	return (
		<CellButton onClick={onClick} style={{ backgroundColor, color }}>
			{notes ? (
				<NoteGrid>
					{range(9).map((i) => (
						<NoteNumber key={i}>
							{notes.has((i + 1) as CellValue) ? toFa(i + 1) : ""}
						</NoteNumber>
					))}
				</NoteGrid>
			) : (
				(value && toFa(value)) || ""
			)}
		</CellButton>
	);
}
