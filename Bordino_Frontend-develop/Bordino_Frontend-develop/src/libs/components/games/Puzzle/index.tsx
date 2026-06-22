"use client";

import React, { memo } from "react";

import SortableItem from "./SortableItem";
import usePuzzle from "./usePuzzle";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import Box from "@libs/components/atoms/Box";
import Grid2 from "@libs/components/atoms/Grid2";
import Typography from "@libs/components/atoms/Typography";

interface PuzzleGameProps {
	imageUrl: string;
	onComplete?: () => void;
}

function PuzzleGame({ imageUrl, onComplete }: Readonly<PuzzleGameProps>) {
	const { pieces, onDragEnd, GRID_SIZE } = usePuzzle({ onComplete });
	return (
		<Box
			textAlign="center"
			alignItems="center"
			display="flex"
			flexDirection="column"
			p={2}
		>
			<Typography variant="h5" mb={2}>
				بازی پازل
			</Typography>
			<DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
				<SortableContext items={pieces} strategy={rectSortingStrategy}>
					<Grid2
						container
						spacing={0}
						justifyContent="center"
						sx={{ width: 300, height: 300 }}
					>
						{pieces.map((piece) => (
							<SortableItem
								key={piece}
								id={piece}
								imageUrl={imageUrl}
								gridSize={GRID_SIZE}
							/>
						))}
					</Grid2>
				</SortableContext>
			</DndContext>
		</Box>
	);
}

export default memo(PuzzleGame);
