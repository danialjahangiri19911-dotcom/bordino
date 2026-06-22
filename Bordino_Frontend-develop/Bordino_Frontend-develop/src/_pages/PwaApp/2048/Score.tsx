"use client";

import { useContext } from "react";

import { GameContext } from "@/libs/context/2048/GameProvider";

import styles from "./score.module.css";

export default function Score() {
	const game = useContext(GameContext);
	if (!game) throw new Error("Score must be used within GameProvider");
	const { score } = game;

	return (
		<div className={styles.score}>
			Score
			<div>{score}</div>
		</div>
	);
}
