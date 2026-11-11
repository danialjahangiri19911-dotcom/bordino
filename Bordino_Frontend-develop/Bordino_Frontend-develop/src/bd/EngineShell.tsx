"use client";

import type { ReactNode } from "react";

import { GameShell } from "./ui";

const HELP: Record<string, ReactNode> = {
	sudoku: (
		<>
			<p>خانه‌های خالی را با عددهای ۱ تا ۹ کامل کن؛ هر عدد در هر سطر، ستون و مربع سه‌در‌سه فقط یک بار می‌آید.</p>
			<p>با بردن در سطح آسان، سطح متوسط و با بردن در متوسط، سطح سخت باز می‌شود. هزینهٔ هر بازی پیش از شروع نشان داده می‌شود.</p>
		</>
	),
	game2048: (
		<p>کاشی‌های هم‌عدد را با کشیدن روی صفحه یا کلیدهای جهت ترکیب کن تا به ۲۰۴۸ برسی. هزینهٔ هر بازی پیش از شروع نشان داده می‌شود.</p>
	),
	crash: (
		<>
			<p>پیش از شروع دور سکهٔ شرط را انتخاب کن. ضریب از ۱٫۰۰ بالا می‌رود؛ قبل از انفجار برداشت کن تا شرط × ضریب را ببری.</p>
			<p>نقطهٔ انفجار را سرور پیش از دور تعیین می‌کند و پس از دور قابل بررسی است (اطلاعات منصفانه بودن داخل بازی).</p>
		</>
	),
};

/** The previous app's sudoku / 2048 / crash engines inside the design's full-width game shell. */
export default function EngineShell({ game, title, children }: { game: "sudoku" | "game2048" | "crash"; title: string; children: ReactNode }) {
	return (
		<GameShell title={title} icon={game === "crash" ? "rocket" : game === "sudoku" ? "puzzle" : "grid-2x2"} help={HELP[game]}>
			<div className={`bd-engine bd-engine-${game}`}>{children}</div>
		</GameShell>
	);
}
