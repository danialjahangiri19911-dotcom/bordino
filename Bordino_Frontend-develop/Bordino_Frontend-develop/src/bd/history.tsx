"use client";

import { useMemo } from "react";

import Icon, { type IconName } from "./Icon";
import { fa } from "./format";
import { EmptyState, LoadState } from "./ui";

import useWalletHistory from "@/api/wallet/hooks/useWalletHistory";
import type { WalletHistoryPage, WalletHistoryRow } from "@/api/wallet/types/walletHistoryType";
import { formatTehranDateTime } from "@/libs/utils/date";

export type HistoryKind = "points" | "currency";
export interface Entry extends WalletHistoryRow {
	kind: HistoryKind;
}

export function rowsOf(pages: (WalletHistoryPage | undefined)[] | undefined, kind: HistoryKind): Entry[] {
	return (pages ?? []).flatMap((page) => page?.results ?? []).map((row) => ({ ...row, kind }));
}

function iconFor(entry: Entry): IconName {
	if (entry.type.endsWith("prize")) return "gift";
	if (entry.type === "ticket_purchase") return "ticket";
	if (entry.type === "wheel_spin") return "disc-3";
	if (entry.type === "withdrawal") return "landmark";
	if (entry.type.endsWith("_bet") || entry.type.endsWith("_win") || entry.type === "game_play") return "gamepad-2";
	if (entry.type === "referral_reward") return "users";
	return entry.kind === "points" ? "coins" : "banknote";
}

export function HistoryRow({ entry }: { entry: Entry }) {
	// Coins: only the number (the wallet is coins); cash keeps its «تومان».
	const unit = entry.kind === "points" ? null : "تومان";
	const failed = entry.status === "failed" || entry.status === "cancelled";
	return (
		<div className="bd-row">
			<span className="bd-mission-icon" aria-hidden="true">
				<Icon name={iconFor(entry)} />
			</span>
			<span>
				<b>{entry.title}</b>
				<small>
					{formatTehranDateTime(entry.date)}
					{entry.destination_name ? ` · ${entry.destination_name}` : ""}
					{entry.status_label ? ` · ${entry.status_label}` : ""}
				</small>
			</span>
			<span className={`bd-amount ${failed ? "" : entry.is_positive ? "is-plus" : "is-minus"}`} dir="ltr">
				{failed ? "" : entry.is_positive ? "+" : "−"}
				{fa(entry.amount)}
				{unit ? <small> {unit}</small> : null}
			</span>
		</div>
	);
}

/** One wallet account's history, newest first, with «نمایش بیشتر» while the server has more. */
export function useHistory(kind: HistoryKind, accountId?: string) {
	const history = useWalletHistory(kind, accountId);
	const rows = useMemo(() => rowsOf(history.data?.pages, kind), [history.data, kind]);
	return { ...history, rows };
}

/** With rows already shown from one account, the other account's failure must still be visible. */
export function PartialHistoryNotice({ parts }: { parts: { label: string; history: { isError: boolean; refetch: () => unknown } }[] }) {
	const failed = parts.filter((p) => p.history.isError);
	if (!failed.length) return null;
	return (
		<div className="rt-notice bd-notice-warn" role="alert">
			تاریخچهٔ {failed.map((p) => p.label).join(" و ")} بارگذاری نشد؛ این فهرست کامل نیست.{" "}
			<button type="button" className="bd-text-btn" onClick={() => failed.forEach((p) => void p.history.refetch())}>
				تلاش دوباره
			</button>
		</div>
	);
}

/** An account's history counts as failed when its summary (which gives the account id) failed too. */
export function withSummary(
	history: { isError: boolean; refetch: () => unknown },
	summary: { error: unknown; refetch: () => unknown },
) {
	return {
		isError: history.isError || !!summary.error,
		refetch: () => (summary.error ? summary.refetch() : history.refetch()),
	};
}

export function HistoryFooter({
	history,
	empty,
	emptyTitle = "هنوز تراکنشی وجود ندارد",
}: {
	history: ReturnType<typeof useHistory>;
	empty: boolean;
	emptyTitle?: string;
}) {
	if (history.isLoading) return <LoadState loading />;
	if (history.isError) return <LoadState error onRetry={() => history.refetch()} errorText="تاریخچه بارگذاری نشد." />;
	if (empty) {
		return <EmptyState title={emptyTitle} text="زمان، نوع و مبلغ هر تراکنش پس از ثبت در این قسمت نمایش داده می‌شود." />;
	}
	if (!history.hasNextPage) return null;
	return (
		<button
			type="button"
			className="bd-secondary bd-more"
			onClick={() => history.fetchNextPage()}
			disabled={history.isFetchingNextPage}
		>
			{history.isFetchingNextPage ? "در حال بارگذاری…" : "نمایش بیشتر"}
		</button>
	);
}
