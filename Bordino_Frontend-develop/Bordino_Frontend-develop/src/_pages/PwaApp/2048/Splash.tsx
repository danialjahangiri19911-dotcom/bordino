"use client";

import { useContext } from "react";

import { GameContext } from "@/libs/context/2048/GameProvider";

import styles from "./splash.module.css";

interface SplashProps {
	heading: string;
	type?: "won" | "lost";
}

export default function Splash({ heading, type = "lost" }: SplashProps) {
	const game = useContext(GameContext);
	if (!game) throw new Error("Splash must be used within GameProvider");
	const { startGame } = game;

	return (
		<div className={`${styles.splash} ${type === "won" ? styles.win : ""}`}>
			<div>
				<h1>{heading}</h1>
				<button className={styles.button} onClick={startGame}>
					Play again
				</button>
			</div>
		</div>
	);
}
