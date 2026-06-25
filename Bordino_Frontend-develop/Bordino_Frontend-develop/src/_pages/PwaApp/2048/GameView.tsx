"use client";

import { useContext, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import Board from "./Board";

import useChargeGamePlay from "@/api/games/useChargeGamePlay";
import useGetPlayCost from "@/api/games/useGetPlayCost";
import { GAME_NET } from "@/constants/routes";
import { GameContext } from "@/libs/context/2048/GameProvider";
import LostDialog from "@/libs/components/games/LostDialog";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

import styles from "./gameView.module.css";

const BEST_KEY = "2048-best-score";

export default function GameView() {
	const game = useContext(GameContext);
	if (!game) throw new Error("GameView must be used within GameProvider");

	const { score, moveCount, tiles, status, startGame, undo, canUndo } = game;

	const { push } = useRouter();
	const { data: costData, refetch: refetchCost } = useGetPlayCost({
		gameName: "game_2048",
	});
	const { chargeAsync, isCharging } = useChargeGamePlay();

	const playCost = costData?.result?.play_cost ?? 0;
	const currentPoints = costData?.result?.current_amount ?? 0;

	// شروعِ یک بازیِ جدید با کسرِ امتیاز (هم برای «بازی مجدد» هم «ادامه پس از باخت»)
	const startPaidGame = async () => {
		try {
			await chargeAsync({ game_name: "game_2048" });
			void refetchCost();
			startGame();
		} catch {
			// خطا (مثلِ امتیازِ ناکافی) توسطِ toastِ سراسری نمایش داده می‌شود
		}
	};

	// رکورد برتر: بیشترین امتیازِ ثبت‌شده (در localStorage)
	const [best, setBest] = useState(0);
	useEffect(() => {
		const stored = Number(localStorage.getItem(BEST_KEY) || 0);
		const next = Math.max(stored, score || 0);
		if (next !== stored) localStorage.setItem(BEST_KEY, String(next));
		setBest(next);
	}, [score]);

	// رکورد ادغام: بزرگ‌ترین کاشیِ روی بُرد
	const maxTile = useMemo(() => {
		const values = Object.values(tiles ?? {}).map((t) => t.value);
		return values.length ? Math.max(...values) : 0;
	}, [tiles]);

	const tickerText = useMemo(
		() => Array.from({ length: 6 }, () => "رکورد برتر امیر: ۲۰۵۸"),
		[],
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

				<div className={styles.boardArea}>
					<Board />
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
