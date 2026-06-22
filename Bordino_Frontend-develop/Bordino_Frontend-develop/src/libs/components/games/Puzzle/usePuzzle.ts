import { useCallback, useEffect, useState } from "react";

import { arrayMove } from "@dnd-kit/sortable";

interface UsePuzzleProps {
	onComplete?: () => void;
}

const GRID_SIZE = 3;

export default function usePuzzle({ onComplete }: Readonly<UsePuzzleProps>) {
	const shuffleArray = useCallback((array: string[]) => {
		return [...array].sort(() => Math.random() - 0.5);
	}, []);

	const initialPieces = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) =>
		i.toString(),
	);

	const [pieces, setPieces] = useState<string[]>(shuffleArray(initialPieces));

	useEffect(() => {
		if (pieces.join("") === initialPieces.join("")) {
			onComplete?.();
		}
	}, [pieces, onComplete, initialPieces]);

	const onDragEnd = useCallback((event: any) => {
		const { active, over } = event;
		if (active.id !== over.id) {
			setPieces((items) => {
				const oldIndex = items.indexOf(active.id);
				const newIndex = items.indexOf(over.id);
				return arrayMove(items, oldIndex, newIndex);
			});
		}
	}, []);

	return { pieces, onDragEnd, GRID_SIZE };
}
