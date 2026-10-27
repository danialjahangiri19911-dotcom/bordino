import React from "react";

import Icon from "@/bd/Icon";
import { fa } from "@/bd/format";
import { toFa } from "@/libs/games/sudoku/faDigits";

interface MenuScreenProps {
	completions: { easy: number; medium: number };
	mediumUnlocked: boolean;
	hardUnlocked: boolean;
	onSelectDifficulty: (difficulty: "easy" | "medium" | "hard") => void;
	/** A game is being started (and paid for): no second tap. */
	busy?: boolean;
	/** Points one game costs and the points the player has (from wallet/games/charge). */
	cost?: number;
	points?: number;
}

/** Level choice in the neobrutalism «انتخاب سطح سودوکو» layout (reference sudoku_levels). */
export function MenuScreen({
	completions,
	mediumUnlocked,
	hardUnlocked,
	onSelectDifficulty,
	busy = false,
	cost,
	points,
}: MenuScreenProps) {
	const levels = [
		{
			key: "easy" as const,
			name: "آسان",
			open: true,
			text: completions.easy > 0 ? `شروعی آرام برای تمرکز · ${toFa(completions.easy)} برد` : "شروعی آرام برای تمرکز",
		},
		{
			key: "medium" as const,
			name: "متوسط",
			open: mediumUnlocked,
			text: mediumUnlocked
				? `چالش جدی‌تر · ${toFa(completions.medium)} از ۲ برد برای باز شدن سخت`
				: "با یک برد در سطح آسان باز می‌شود.",
		},
		{
			key: "hard" as const,
			name: "سخت",
			open: hardUnlocked,
			text: hardUnlocked ? "برای حرفه‌ای‌ها" : "با دو برد در سطح متوسط باز می‌شود.",
		},
	];
	return (
		<div dir="rtl">
			<p className="rt-page-intro">
				از آسان شروع کن؛ با پیشرفت در بازی، سطح‌های بعدی باز می‌شوند.
				{cost !== undefined ? ` هر بازی ${fa(cost)} امتیاز` : ""}
				{points !== undefined ? ` · موجودی تو ${fa(points)} امتیاز` : ""}
			</p>
			<div className="rt-three">
				{levels.map((level) => (
					<section key={level.key} className="bd-panel rt-panel">
						<h3>{level.name}</h3>
						<div className="rt-level-icon">
							<Icon name={level.open ? "puzzle" : "lock-keyhole"} />
						</div>
						<p>{level.text}</p>
						{level.open ? (
							<button type="button" className="bd-action" disabled={busy} onClick={() => onSelectDifficulty(level.key)}>
								{busy ? "در حال شروع…" : "شروع سودوکو"}
							</button>
						) : (
							<button type="button" className="bd-secondary" disabled>
								قفل است
							</button>
						)}
					</section>
				))}
			</div>
		</div>
	);
}
