"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { fa } from "../format";
import { AppShell, EmptyState, Facts, LoadState, Notice, Panel, R, usePoints } from "../ui";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

/**
 * «تبدیل امتیاز به بلیت»: choose how many tickets, then pick each ticket's numbers on the
 * purchase page. Nothing is charged here: each ticket is paid when its numbers are submitted,
 * bound to this lottery and this price (a changed offer is refused by the server).
 */
export default function Tickets() {
	const { push } = useRouter();
	const points = usePoints();
	const { activeLotteries: lottery } = useExtractLotteries();
	const [text, setText] = useState("1");

	const price = lottery ? Number(lottery.ticket_price) : 0;
	const count = Number(persianNumberConverter(text));
	const valid = Number.isInteger(count) && count >= 1;
	const balance = points.points ?? 0;
	const affordable = price > 0 ? Math.floor(balance / price) : 0;
	const needed = valid ? count * price : price;
	const enough = valid && balance >= needed;
	const salesOpen = !!lottery && new Date(lottery.end_date).getTime() > Date.now();

	let problem: string | null = null;
	if (!lottery) problem = "قرعه‌کشی فعالی نیست؛ دورهٔ بعدی به‌زودی اعلام می‌شود.";
	else if (!salesOpen) problem = "فروش بلیت این دوره بسته شده است.";
	else if (!valid) problem = "تعداد بلیت باید یک عدد صحیح و حداقل ۱ باشد.";
	else if (!enough) problem = `موجودی کافی نیست؛ با موجودی فعلی ${fa(affordable)} بلیت می‌توانی بگیری.`;

	return (
		<AppShell nav="wallet" title="تبدیل امتیاز به بلیت">
			<Panel title="تبدیل امتیاز به بلیت">
				{points.points === null ? (
					<LoadState loading={points.isLoading} error={points.error} onRetry={points.refetch} />
				) : !lottery ? (
					<EmptyState
						title="قرعه‌کشی فعالی نیست"
						text="دورهٔ بعدی به‌زودی اعلام می‌شود."
						action={
							<Link className="bd-secondary" href={R.lotteries}>
								مشاهدهٔ دوره‌ها
							</Link>
						}
					/>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (problem) return;
							push(
								addSearchParamsToUrl(R.buyTicket, {
									count: String(count),
									lottery: lottery.id,
									price: String(price),
								}),
							);
						}}
					>
						<div className="rt-conversion" aria-label={`${fa(price)} امتیاز برای هر بلیت`}>
							<span>
								<b>{fa(price)}</b>امتیاز
							</span>
							<Icon name="arrow-left" />
							<span>
								<b>۱</b>بلیت
							</span>
						</div>
						<label className="rt-field">
							<span>تعداد بلیت</span>
							<input
								type="text"
								inputMode="numeric"
								dir="ltr"
								value={text}
								onChange={(event) => setText(event.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 3))}
								aria-describedby="tickets-problem"
							/>
						</label>
						<Facts
							items={[
								["دوره", lottery.name],
								["موجودی", `${fa(balance)} امتیاز`],
								["امتیاز لازم", `${fa(valid ? needed : price)} امتیاز`],
							]}
						/>
						<div id="tickets-problem">{problem ? <Notice>{problem}</Notice> : null}</div>
						<button className="bd-action" type="submit" disabled={!!problem}>
							انتخاب عددهای بلیت
						</button>
						<p className="bd-muted">امتیاز هر بلیت هنگام ثبت عددهایش کسر می‌شود.</p>
					</form>
				)}
			</Panel>
		</AppShell>
	);
}
