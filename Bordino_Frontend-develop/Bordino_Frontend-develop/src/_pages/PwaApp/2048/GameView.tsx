"use client";

import { useContext, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import Board from "./Board";

import useGetPlayCost from "@/api/games/useGetPlayCost";
import { GAME_NET } from "@/constants/routes";
import { GameContext } from "@/libs/context/2048/GameProvider";
import LostDialog from "@/libs/components/games/LostDialog";
import { currentUserId } from "@/libs/stores/authStore";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

import styles from "./gameView.module.css";

// Per account: another user on this phone starts with their own record.
const bestKey = () => `2048-best-score:${currentUserId()}`;

export default function GameView() {
	const game = useContext(GameContext);
	if (!game) throw new Error("GameView must be used within GameProvider");

	const { score, moveCount, tiles, status, undo, canUndo, isCharging, needsStart } = game;

	const { push } = useRouter();
	const { data: costData, refetch: refetchCost } = useGetPlayCost({
		gameName: "game_2048",
	});

	const playCost = costData?.result?.play_cost ?? 0;
	const currentPoints = costData?.result?.current_amount ?? 0;

	// شروعِ یک بازیِ جدید با کسرِ امتیاز (اولین بازی، «بازی مجدد»، «ادامه پس از باخت»): the
	// provider charges, then starts the board.
	const startPaidGame = async () => {
		if (await game.startPaidGame()) void refetchCost();
	};

	// رکورد برتر: بیشترین امتیازِ ثبت‌شده (در localStorage)
	const [best, setBest] = useState(0);
	useEffect(() => {
		const stored = Number(localStorage.getItem(bestKey()) || 0);
		const next = Math.max(stored, score || 0);
		if (next !== stored) localStorage.setItem(bestKey(), String(next));
		setBest(next);
	}, [score]);

	// رکورد ادغام: بزرگ‌ترین کاشیِ روی بُرد
	const maxTile = useMemo(() => {
		const values = Object.values(tiles ?? {}).map((t) => t.value);
		return values.length ? Math.max(...values) : 0;
	}, [tiles]);

	// The player's own record (the ticker used to show a made-up «رکورد برتر امیر: ۲۰۵۸»).
	const tickerText = useMemo(
		() => Array.from({ length: 6 }, () => `رکورد برتر تو: ${toPersianDigits(best)}`),
		[best],
	);

	return (
		<div className={styles.wrap}>
			<div className={styles.inner}>
				<header className={styles.header}>
					<div className={styles.statsCol}>
						<div className={styles.statsRow}>
							<div className={styles.statCard}>
								<span className={styles.statLabel}>رکورد برتر</span>
								<span className={styles.statValue}>
									{toPersianDigits(best)}
								</span>
							</div>
							<div className={styles.statCard}>
								<span className={styles.statLabel}>رکورد ادغام</span>
								<span className={styles.statValue}>
									{toPersianDigits(maxTile)}
								</span>
							</div>
						</div>
						<div className={styles.buttonsRow}>
							<button
								type="button"
								className={styles.actionBtn}
								onClick={undo}
								disabled={!canUndo}
							>
								برگشت
							</button>
							<button
								type="button"
								className={styles.actionBtn}
								onClick={startPaidGame}
								disabled={isCharging}
							>
								بازی مجدد
							</button>
						</div>
					</div>

					<div className={styles.logo}>
						{/* لوگوی ۲۰۴۸ (همان آیکونِ گیمنت) */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/media/App/games/game2048-icon.png" alt="2048" />
					</div>
				</header>

				<div className={styles.ticker}>
					<div className={styles.tickerInner}>
						{tickerText.concat(tickerText).map((t, i) => (
							<span key={i}>{t}</span>
						))}
					</div>
				</div>

				<div className={styles.boardArea} style={{ position: "relative" }}>
					<Board />
					{needsStart && (
						// No paid game yet: the board is not playable until the play is charged.
						<div
							style={{
								position: "absolute",
								inset: 0,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								gap: 12,
								background: "rgba(0,0,0,0.55)",
								borderRadius: 12,
								color: "#fff",
								zIndex: 2,
							}}
						>
							<span>هر بازی {toPersianDigits(playCost)} امتیاز</span>
							<button
								type="button"
								className={styles.actionBtn}
								onClick={startPaidGame}
								disabled={isCharging}
								autoFocus
							>
								شروع بازی
							</button>
						</div>
					)}
				</div>

				<div className={styles.moveCounter}>
					{toPersianDigits(moveCount)} حرکت
				</div>
			</div>

			<LostDialog
				open={status === "lost"}
				description="دیگه حرکتی باقی نمونده و بازی رو باختی."
				points={currentPoints}
				cost={playCost}
				loading={isCharging}
				onContinue={startPaidGame}
				onCancel={() => push(GAME_NET.path)}
			/>
		</div>
	);
}
