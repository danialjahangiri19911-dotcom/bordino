import React, { memo } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Grid2 from "@libs/components/atoms/Grid2";

interface SortableItemProps {
	id: string;
	imageUrl: string;
	gridSize: number;
}

function SortableItem({ id, imageUrl, gridSize }: Readonly<SortableItemProps>) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({
			id,
			animateLayoutChanges: () => false,
		});

	return (
		<Grid2
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			sx={{
				transform: CSS.Transform.toString(transform),
				transition,
				width: `${100 / gridSize}%`,
				height: `${100 / gridSize}%`,
				backgroundImage: `url(${imageUrl})`,
				backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
				backgroundPosition: `${(parseInt(id) % gridSize) * (100 / (gridSize - 1))}% ${Math.floor(parseInt(id) / gridSize) * (100 / (gridSize - 1))}%`,
				border: "1px solid #ccc",
				boxSizing: "border-box",
				touchAction: "none",
			}}
		/>
	);
}

export default memo(SortableItem);
