"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { fa } from "../format";
import { AppShell, EmptyState, Facts, Notice, Panel, R } from "../ui";
import { Numbers } from "./LotteryDetail";

import useButTicket from "@/_pages/PwaApp/Lottery/BuyTicket/useButTicket";

const BALLS = Array.from({ length: 40 }, (_, i) => i + 1);

/** Pick a ticket's six numbers; the ticket is created and paid for when they are submitted. */
export default function BuyTicket() {
	const params = useSearchParams();
	const count = Math.max(1, Number(params.get("count")) || 1);
	const done = Math.max(0, Number(params.get("done")) || 0);
	const {
		selectedBalls,
		handleBallClick,
		handleSubmit,
		isSubmitting,
		snackbarMessage,
		offerPrice,
		hasOffer,
		setSelectedBalls,
	} = useButTicket();

	return (
		<AppShell nav="wallet" title="انتخاب عددهای بلیت">
			{!hasOffer ? (
				<Panel>
					<EmptyState
						title="قرعه‌کشی فعالی نیست"
						text="بلیت فقط برای دورهٔ در حال فروش ثبت می‌شود."
						action={
							<Link className="bd-secondary" href={R.lotteries}>
								مشاهدهٔ دوره‌ها
							</Link>
						}
					/>
				</Panel>
			) : (
				<div className="rt-two">
					<Panel title={`بلیت ${fa(Math.min(done + 1, count))} از ${fa(count)}`}>
						<p>شش عدد از ۱ تا ۴۰ انتخاب کن.</p>
						<div className="bd-balls" role="group" aria-label="عددهای بلیت">
							{BALLS.map((n) => {
								const chosen = selectedBalls.includes(n);
								return (
									<button
										key={n}
										type="button"
										className="bd-ball"
										aria-pressed={chosen}
										aria-label={`عدد ${fa(n)}`}
										disabled={!chosen && selectedBalls.length >= 6}
										onClick={() => handleBallClick(n)}
									>
										{fa(n)}
									</button>
								);
							})}
						</div>
					</Panel>
					<Panel title="بلیت تو">
						{selectedBalls.length ? (
							<Numbers numbers={[...selectedBalls].sort((a, b) => a - b)} />
						) : (
							<p className="bd-muted">هنوز عددی انتخاب نشده.</p>
						)}
						<Facts
							items={[
								["عددهای انتخاب‌شده", `${fa(selectedBalls.length)} از ۶`],
								["هزینهٔ این بلیت", offerPrice !== undefined ? `${fa(offerPrice)} سکه` : "—"],
							]}
						/>
						{snackbarMessage ? <Notice>{snackbarMessage}</Notice> : null}
						<div className="bd-actions">
							<button
								type="button"
								className="bd-action"
								disabled={selectedBalls.length !== 6 || isSubmitting}
								onClick={handleSubmit}
							>
								{isSubmitting ? "در حال ثبت…" : "ثبت بلیت"}
							</button>
							<button
								type="button"
								className="bd-secondary"
								disabled={!selectedBalls.length || isSubmitting}
								onClick={() => setSelectedBalls([])}
							>
								پاک کردن
							</button>
						</div>
						<small className="bd-muted">سکهٔ این بلیت هنگام ثبت کسر می‌شود.</small>
					</Panel>
				</div>
			)}
		</AppShell>
	);
}
