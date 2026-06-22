"use client";

import Board from "@/_pages/PwaApp/2048/Board";
import HistoryControls from "@/_pages/PwaApp/2048/HistoryControls";
import MoveCounter from "@/_pages/PwaApp/2048/MoveCounter";
import Score from "@/_pages/PwaApp/2048/Score";
import Timer from "@/_pages/PwaApp/2048/Timer";
import PersistedGameProvider from "@/libs/context/2048/PersistedGameProvider";

import styles from "./page.module.css";

export default function Home() {
	return (
		<PersistedGameProvider>
			<div className={styles.twenty48}>
				<header>
					<h1>2048</h1>
					<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
						<Timer />
						<MoveCounter />
						<Score />
					</div>
				</header>
				<main>
					<Board />
					<HistoryControls />
				</main>
			</div>
		</PersistedGameProvider>
	);
}
