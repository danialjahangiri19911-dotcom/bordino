"use client";

import React, { useCallback, useContext, useEffect } from "react";

import MobileSwiper from "./MobileSwiper";
import type { SwipeInput } from "./MobileSwiper";
import Splash from "./Splash";
import Tile from "./Tile";

import { GameContext } from "@/libs/context/2048/GameProvider";

import styles from "./board.module.css";

const ARROWS: Record<string, "up" | "down" | "left" | "right"> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
};

export default function Board() {
	const game = useContext(GameContext);
	if (!game) throw new Error("Board must be used within GameProvider");
	const { move, status, tiles, tilesByIds, needsStart } = game;

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			// Only the arrows move tiles, and only on a paid game; every other key (Tab, Space,
			// Enter on a button) keeps working, and keys typed into a control are left alone.
			const direction = ARROWS[e.code];
			if (!direction || needsStart) return;
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
			e.preventDefault();
			move(direction);
		},
		[move, needsStart],
	);

	const handleSwipe = useCallback(
		({ deltaX, deltaY }: SwipeInput) => {
			if (needsStart) return;
			if (Math.abs(deltaX) > Math.abs(deltaY)) {
				if (deltaX > 0) move("right");
				else move("left");
			} else {
				if (deltaY > 0) move("down");
				else move("up");
			}
		},
		[move, needsStart],
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
				{status === "won" && <Splash type="won" />}
				{/* حالتِ باخت در GameView با دیالوگِ «باختی!» مدیریت می‌شود */}
				<div className={styles.tiles}>{renderTiles()}</div>
				<div className={styles.grid}>{renderGrid()}</div>
			</div>
		</MobileSwiper>
	);
}
