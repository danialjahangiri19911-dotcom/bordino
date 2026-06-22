"use client";

import { useEffect, useState } from "react";

import {
	containerWidthDesktop,
	containerWidthMobile,
	mergeAnimationDuration,
	TILE_COUNT_PER_DIMENSION as tileCountPerDimension,
} from "@/constants/2048";
import type { Tile as TileProps } from "@/libs/games/2048/types";
import usePreviousProps from "@/libs/hooks/usePrevious";
import { useMediaQuery } from "@/libs/uiHooks/device";

import styles from "./tile.module.css";

export default function Tile({
	position,
	value,
	id,
}: TileProps & { id?: string }) {
	const isWideScreen = useMediaQuery("(min-width:512px)");
	const containerWidth = isWideScreen
		? containerWidthDesktop
		: containerWidthMobile;

	const [scale, setScale] = useState(1);
	const previousValue = usePreviousProps(value);
	// Animate on value change, including the initial appearance (undefined → value)
	const hasChanged = previousValue !== value;

	const positionToPixels = (pos: number) =>
		(pos / tileCountPerDimension) * containerWidth;

	useEffect(() => {
		if (hasChanged) {
			setScale(1.1);
			setTimeout(() => setScale(1), mergeAnimationDuration);
		}
	}, [hasChanged]);

	const style = {
		left: positionToPixels(position[0]),
		top: positionToPixels(position[1]),
		transform: `scale(${scale})`,
		zIndex: value,
	};

	// Guard against missing or invalid position
	if (!position || !Array.isArray(position) || position.length !== 2) {
		console.error("Tile rendered without a valid position", {
			id,
			position,
			value,
		});
		return null;
	}

	return (
		<div className={`${styles.tile} ${styles[`tile${value}`]}`} style={style}>
			{value}
		</div>
	);
}
