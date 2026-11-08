"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { type LeaderRow, type LeaderShow, LeaderList } from "../board";
import { fa } from "../format";
import { moreOfBoard, showMyName, useMysteryBoard } from "../missions/mystery";
import { AppShell, EmptyState, LoadState, Notice, R } from "../ui";

import { gameErrorMessage } from "@/api/games/request";

const WHY: Record<string, string> = {
	off: "این بازی جدول رده‌بندی ندارد.",
	not_playing: "جدول این بازی را شرکت‌کنندگانش می‌بینند؛ اول بازی را شروع کن.",
	finish_first: "جدول این بازی بعد از تمام کردنش باز می‌شود.",
	creator_only: "جدول این بازی را فقط سازنده‌اش می‌بیند.",
	hidden: "بازی تمام شده و جدولش برای بازیکنان پنهان است.",
};

/** A game's leaderboard in Player Mode: the totals, my own place, and the ranks a page at a time. */
export default function MysteryBoard({ id }: { id: string }) {
	const { data, isLoading, error, refetch } = useMysteryBoard(id);
	const b = data?.result?.board;
	const [extra, setExtra] = useState<LeaderRow[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [more, setMore] = useState<boolean | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [mine, setMine] = useState<boolean | null>(null);
	useEffect(() => {
		setExtra([]);
		setMore(null);
	}, [data]);
	const rows = [...(b?.rows ?? []), ...extra];
	const loadMore = async () => {
		setLoadingMore(true);
		try {
			const next = (await moreOfBoard(id, rows.length)).board;
			setExtra((x) => [...x, ...(next.rows ?? [])]);
			setMore(!!next.more);
		} catch (e) {
			setProblem(gameErrorMessage(e));
		}
		setLoadingMore(false);
	};
	const toggleName = async (show: boolean) => {
		try {
			await showMyName(id, show);
			setMine(show);
			void refetch();
		} catch (e) {
			setProblem(gameErrorMessage(e));
		}
	};
	const show: LeaderShow = b?.config.show ?? {};
	const me = b?.me ?? null;
	const meShown = !!me && rows.some((r) => r.is_me);
	return (
		<AppShell nav="earn" title={b?.title ? `جدول «${b.title}»` : "جدول رده‌بندی"}>
			<Link className="my-back" href={R.mystery(id)}>
				<Icon name="arrow-left" /> برگشت به بازی
			</Link>
			<LoadState loading={isLoading} error={error} onRetry={refetch} />
			{b ? (
				<>
					<section className="bd-panel lb-summary">
						<h2>{b.title}</h2>
						<ul className="my-facts">
							{show.participants !== false ? (
								<li>
									<Icon name="users" /> {fa(b.totals.players)} شرکت‌کننده
								</li>
							) : null}
							{show.finishers !== false ? (
								<li>
									<Icon name="trophy" /> {fa(b.totals.finishers)} نفر تمام کردند
								</li>
							) : null}
							<li>
								<Icon name="flag" /> {fa(b.totals.stages)} مرحله
							</li>
						</ul>
						{b.config.rules ? <p className="bd-muted">{b.config.rules}</p> : null}
						{b.final ? <span className="bd-tag">نتیجهٔ نهایی</span> : b.visible ? <span className="bd-tag">تا پایان بازی ممکن است تغییر کند</span> : null}
					</section>

					{!b.visible ? (
						<EmptyState
							icon="trophy"
							title="جدول در دسترس نیست"
							text={WHY[b.reason] ?? "جدول این بازی الان در دسترس نیست."}
							action={
								<Link className="bd-action" href={R.mystery(id)}>
									برگشت به بازی
								</Link>
							}
						/>
					) : (
						<>
							{me ? (
								<div className="bd-panel lb-mine">
									<b>رتبهٔ تو: {fa(me.position)}</b>
									<small>
										{fa(me.stages)} از {fa(me.total)} مرحله · {fa(me.score)} امتیاز
									</small>
									{!meShown ? <LeaderList rows={[me]} show={show} highlightMe={b.config.highlight_me !== false} /> : null}
								</div>
							) : b.my_progress ? (
								<Notice tone="info">
									پیشرفت تو: {fa(b.my_progress.stages)} از {fa(b.totals.stages)} مرحله.{" "}
									{b.config.only_finishers ? "بعد از تمام کردن بازی رتبه می‌گیری." : "با حل اولین مرحله در جدول می‌آیی."}
								</Notice>
							) : null}
							{rows.length ? (
								<LeaderList rows={rows} show={show} highlightMe={b.config.highlight_me !== false} />
							) : (
								<EmptyState
									icon="trophy"
									title={b.config.only_finishers ? "هنوز کسی بازی را تمام نکرده" : "هنوز کسی در جدول نیست"}
									text="اولین نفر باش!"
								/>
							)}
							{(more ?? b.more) ? (
								<button type="button" className="bd-secondary lb-more" disabled={loadingMore} onClick={() => void loadMore()}>
									{loadingMore ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="chevron-down" />} بیشتر
								</button>
							) : null}
							{me || b.my_progress ? (
								<label className="gm-check lb-identity">
									<input type="checkbox" checked={mine ?? !!b.show_identity} onChange={(e) => void toggleName(e.target.checked)} />{" "}
									نام و عکس پروفایلم برای بقیه در این جدول دیده شود (وگرنه نامت پوشیده می‌ماند)
								</label>
							) : null}
						</>
					)}
					{problem ? <Notice>{problem}</Notice> : null}
				</>
			) : null}
		</AppShell>
	);
}
