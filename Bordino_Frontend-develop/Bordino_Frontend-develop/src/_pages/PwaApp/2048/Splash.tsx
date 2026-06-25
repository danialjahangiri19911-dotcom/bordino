"use client";

import { useContext } from "react";

import { GameContext } from "@/libs/context/2048/GameProvider";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

import styles from "./splash.module.css";

interface SplashProps {
	type?: "won" | "lost";
}

export default function Splash({ type = "lost" }: SplashProps) {
	const game = useContext(GameContext);
	if (!game) throw new Error("Splash must be used within GameProvider");
	const { startGame, moveCount } = game;

	const won = type === "won";

	return (
		<div className={`${styles.splash} ${won ? styles.win : styles.lose}`}>
			<div className={styles.content}>
				<h1 className={styles.heading}>
					{won ? "🎉 تبریک!" : "متاسفم، باختی!"}
				</h1>
				{won ? (
					<>
						<p className={styles.desc}>تو قفل ۲۰۴۸ رو باز کردی.</p>
						<p className={styles.sub}>
							تو {toPersianDigits(moveCount)} تا حرکت داشتی
						</p>
					</>
				) : (
					<p className={styles.desc}>دوباره تلاش کن و رکوردتو بزن.</p>
				)}
				<button type="button" className={styles.button} onClick={startGame}>
					بازی مجدد
				</button>
			</div>
		</div>
	);
}
