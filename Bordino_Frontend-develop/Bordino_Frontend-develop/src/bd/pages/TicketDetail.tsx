"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { fa } from "../format";
import { AppShell, Facts, LoadState, Notice, Panel, R } from "../ui";
import { Numbers } from "./LotteryDetail";

import useGetTicketDetail from "@/api/lottery/hooks/useGetTIcketDetail";
import { formatTehranDateTime } from "@/libs/utils/date";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

function statusText(status?: string, matched?: number | null) {
	if (status === "completed") return matched ? `برگزار شده · ${fa(matched)} عدد درست` : "برگزار شده · بدون عدد درست";
	if (status === "cancelled") return "لغو شده";
	return "در انتظار قرعه‌کشی";
}

export default function TicketDetail() {
	const { id } = useParams<{ id: string }>();
	const params = useSearchParams();
	const { data, isLoading, error, refetch } = useGetTicketDetail({ id });
	const ticket = data?.result;

	// After a purchase the URL carries the progress of that purchase (count / done) and the offer.
	const inPurchase = params.has("count");
	const count = Math.max(1, Number(params.get("count")) || 1);
	const done = Math.max(0, Number(params.get("done")) || 0);
	const nextHref = addSearchParamsToUrl(R.buyTicket, {
		count: String(count),
		done: String(done),
		...(params.get("lottery") && params.get("price") ? { lottery: params.get("lottery")!, price: params.get("price")! } : {}),
	});
	const number = params.get("n");

	return (
		<AppShell nav="wallet" title={number ? `بلیت شمارهٔ ${fa(number)}` : "اطلاعات بلیت"}>
			{!ticket ? (
				<LoadState loading={isLoading || !error} error={error} onRetry={refetch} />
			) : (
				<div className="rt-two">
					<Panel title="عددهای بلیت">
						{inPurchase ? <Notice tone="ok">بلیت ثبت شد ({fa(Math.min(done, count))} از {fa(count)}).</Notice> : null}
						<Numbers numbers={ticket.numbers ?? []} hits={ticket.winning_numbers ?? []} />
						{ticket.winning_numbers?.length ? (
							<>
								<p>عددهای برنده:</p>
								<Numbers numbers={ticket.winning_numbers} />
							</>
						) : null}
					</Panel>
					<Panel title="جزئیات">
						<Facts
							items={[
								["عنوان", ticket.name],
								["زمان ثبت", formatTehranDateTime(ticket.update_time)],
								["شناسه", <bdi key="ref">{ticket.reference}</bdi>],
								["وضعیت", statusText(ticket.lottery_status, ticket.matched_count)],
							]}
						/>
						<div className="bd-actions">
							{inPurchase && done < count ? (
								<Link className="bd-action" href={nextHref}>
									بلیت بعدی ({fa(done + 1)} از {fa(count)})
								</Link>
							) : null}
							<Link className={inPurchase && done < count ? "bd-secondary" : "bd-action"} href={R.lotteries}>
								{inPurchase && done >= count ? "پایان خرید" : "قرعه‌کشی‌ها"}
							</Link>
						</div>
					</Panel>
				</div>
			)}
		</AppShell>
	);
}
