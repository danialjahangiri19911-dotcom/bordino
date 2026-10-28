"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { fa } from "../format";
import { AppShell, Facts, LoadState, Notice, Panel, R } from "../ui";

import { GUIDE_SECTIONS } from "@/_pages/PwaApp/Lottery/LotteryGuide/content";
import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";

/** The steps of a lottery and, while one runs, its real prize table. */
export function GuideSteps() {
	return (
		<>
			{GUIDE_SECTIONS.map((section, index) => (
				<details key={section.title} open={index === 0}>
					<summary>
						{fa(index + 1)}. {section.title}
					</summary>
					{section.paragraphs.map((p, i) => (
						<p key={i} className={p.muted ? "bd-muted" : undefined} style={{ whiteSpace: "pre-line" }}>
							{p.text.trim()}
						</p>
					))}
				</details>
			))}
		</>
	);
}

export function PrizeTable() {
	const { activeLotteries: lottery, loaded, error, refetch } = useExtractLotteries();
	const rules = [...(lottery?.prize_rules ?? [])].sort((a, b) => b.match_count - a.match_count);
	if (!lottery && !loaded) return <LoadState loading={!error} error={error} onRetry={refetch} errorText="جدول جایزه بارگذاری نشد." />;
	if (!lottery || !rules.length) return <p className="bd-muted">جدول جایزهٔ هر دوره هنگام شروع آن دوره اعلام می‌شود.</p>;
	return (
		<>
			<Facts
				items={rules.map((rule) => [
					`${fa(rule.match_count)} عدد درست`,
					rule.match_count === 6 ? "سهم برابر از باقی‌ماندهٔ جایزه" : `${fa(rule.prize_amount)} تومان برای هر بلیت`,
				])}
			/>
			<p className="bd-muted">
				جایزه‌ها از موجودی جایزهٔ همان دوره ({fa(lottery.balance_in_money)} تومان تا این لحظه) پرداخت می‌شوند؛ اگر موجودی کافی نباشد،
				همهٔ جایزه‌ها به یک نسبت کم می‌شوند. عددهای برنده را سرور در زمان قرعه‌کشی به‌صورت تصادفی انتخاب می‌کند.
			</p>
		</>
	);
}

export default function Guide() {
	// The guide is opened from the lottery pages (wallet tab) and from the profile; the tab the
	// player came from stays selected («?from=profile»).
	const [nav, setNav] = useState<"wallet" | "profile">("wallet");
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get("from") === "profile") setNav("profile");
	}, []);
	return (
		<AppShell nav={nav} title="راهنمای قرعه‌کشی">
			<div className="rt-two">
				<Panel title="قرعه‌کشی چطور کار می‌کند؟">
					<div className="rt-document">
						<GuideSteps />
					</div>
				</Panel>
				<Panel title="جایزهٔ هر بلیت">
					<PrizeTable />
					<div className="bd-actions">
						<Link className="bd-action" href={R.lotteries}>
							دوره‌های قرعه‌کشی
						</Link>
					</div>
				</Panel>
			</div>
		</AppShell>
	);
}
