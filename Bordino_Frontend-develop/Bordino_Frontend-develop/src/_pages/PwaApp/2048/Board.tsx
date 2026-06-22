"use client";

import React, { useCallback, useContext, useEffect } from "react";

import MobileSwiper from "./MobileSwiper";
import type { SwipeInput } from "./MobileSwiper";
import Splash from "./Splash";
import Tile from "./Tile";

import { GameContext } from "@/libs/context/2048/GameProvider";

import styles from "./board.module.css";

export default function Board() {
	const game = useContext(GameContext);
	if (!game) throw new Error("Board must be used within GameProvider");
	const { move, status, tiles, tilesByIds } = game;

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			e.preventDefault();
			switch (e.code) {
				case "ArrowUp":
					move("up");
					break;
				case "ArrowDown":
					move("down");
					break;
				case "ArrowLeft":
					move("left");
					break;
				case "ArrowRight":
					move("right");
					break;
			}
		},
		[move],
	);

	const handleSwipe = useCallback(
		({ deltaX, deltaY }: SwipeInput) => {
			if (Math.abs(deltaX) > Math.abs(deltaY)) {
				if (deltaX > 0) move("right");
				else move("left");
			} else {
				if (deltaY > 0) move("down");
				else move("up");
			}
		},
		[move],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	const renderGrid = () => {
		const cells: React.ReactNode[] = [];
		for (let i = 0; i < 16; i++) {
			cells.push(<div key={i} className={styles.cell} />);
		}
		return cells;
	};

	const renderTiles = () => {
		return tilesByIds.map((id) => <Tile key={id} {...tiles[id]} />);
	};

	return (
		<MobileSwiper onSwipe={handleSwipe}>
			<div className={styles.board}>
				{status === "won" && <Splash heading="You won!" type="won" />}
				{status === "lost" && <Splash heading="You lost!" />}
				<div className={styles.tiles}>{renderTiles()}</div>
				<div className={styles.grid}>{renderGrid()}</div>
			</div>
		</MobileSwiper>
	);
}
