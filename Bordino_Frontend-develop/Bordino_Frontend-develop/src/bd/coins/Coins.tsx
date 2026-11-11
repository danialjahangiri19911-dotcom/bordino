"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../Icon";
import { fa } from "../format";
import { AppShell, EmptyState, Facts, LoadState, Notice, Panel, R } from "../ui";
import { type CoinPackage, type CoinPurchase, buyPackage, useCoinShop, verifyPurchase } from "./api";

import { gameErrorMessage } from "@/api/games/request";

const toman = (n: number) => `${fa(n)} تومان`;

/** One package as a card: its coins, its price, and the discount when there is one. */
function PackCard({ pack, onPick, disabled }: { pack: CoinPackage; onPick: () => void; disabled: boolean }) {
	const discounted = pack.discount_percent > 0 && pack.original_price_toman;
	return (
		<button type="button" className={`bd-panel bd-coin-pack${discounted ? " is-discounted" : ""}`} disabled={disabled} onClick={onPick} aria-label={`${fa(pack.coins)} سکه، ${toman(pack.price_toman)}${discounted ? `، ${fa(pack.discount_percent)}٪ تخفیف` : ""}`}>
			{pack.badge || discounted ? (
				<span className="bd-coin-tags">
					{discounted ? <span className="bd-tag bd-coin-off">{fa(pack.discount_percent)}٪ تخفیف</span> : null}
					{pack.badge ? <span className="bd-tag">{pack.badge}</span> : null}
				</span>
			) : null}
			<span className="bd-mission-icon bd-coin-icon" aria-hidden="true">
				<Icon name="coins" />
			</span>
			<strong className="bd-coin-count">
				{fa(pack.coins)} <small>سکه</small>
			</strong>
			<span className="bd-coin-price">
				{discounted ? <s>{toman(pack.original_price_toman as number)}</s> : null}
				<b>{toman(pack.price_toman)}</b>
			</span>
			<span className="bd-coin-buy">
				خرید <Icon name="chevron-left" />
			</span>
		</button>
	);
}

/** «خرید سکه»: the packages on sale. Picking one opens its checkout. */
export function CoinShopPage() {
	const shop = useCoinShop();
	const { push } = useRouter();
	const data = shop.data?.result;
	return (
		<AppShell nav="wallet" title="خرید سکه">
			<Panel title="موجودی کیف">
				{data ? (
					<strong className="rt-big">
						{fa(data.balance)} <small>سکه</small>
					</strong>
				) : (
					<LoadState loading={shop.isLoading} error={shop.error} onRetry={shop.refetch} />
				)}
				<p className="bd-muted">با سکه بلیت قرعه‌کشی بگیر و بازی کن. هر چه بسته بزرگ‌تر باشد، هر سکه ارزان‌تر است.</p>
			</Panel>
			{data && !data.open ? <Notice tone="info">خرید سکه فعلاً بسته است؛ کمی بعد دوباره سر بزن.</Notice> : null}
			{data ? (
				data.packages.length ? (
					<div className="bd-coin-packs rt-gap-top" role="list">
						{data.packages.map((p) => (
							<div role="listitem" key={p.id}>
								<PackCard pack={p} disabled={!data.open} onPick={() => push(`${R.coins}/checkout?package=${encodeURIComponent(p.id)}`)} />
							</div>
						))}
					</div>
				) : (
					<Panel>
						<EmptyState icon="coins" title="بسته‌ای برای فروش نیست" text="به‌زودی بسته‌های سکه اضافه می‌شوند." />
					</Panel>
				)
			) : null}
			<div className="bd-actions rt-gap-top">
				<Link className="bd-secondary" href={R.wallet}>
					برگشت به کیف
				</Link>
			</div>
		</AppShell>
	);
}

/** The chosen package before paying: what it gives, its discount and the amount to pay. */
export function CoinCheckoutPage() {
	const params = useSearchParams();
	const shop = useCoinShop();
	const { push } = useRouter();
	const [paying, setPaying] = useState(false);
	const [failed, setFailed] = useState("");
	const id = params.get("package") ?? "";
	const data = shop.data?.result;
	const pack = data?.packages.find((p) => p.id === id);

	const pay = async () => {
		if (!pack || paying) return;
		setPaying(true);
		setFailed("");
		try {
			const started = await buyPackage(pack.id);
			const url = new URL(started.payment_url, window.location.origin);
			// The sandbox page is the app's own: open it here; Zibal's page is a real navigation.
			if (started.mode === "sandbox") push(`${url.pathname}${url.search}`);
			else window.location.assign(url.toString());
		} catch (e) {
			setFailed(gameErrorMessage(e));
			setPaying(false);
		}
	};

	return (
		<AppShell nav="wallet" title="پرداخت">
			{!data ? (
				<Panel>
					<LoadState loading={shop.isLoading} error={shop.error} onRetry={shop.refetch} />
				</Panel>
			) : !pack ? (
				<Panel>
					<EmptyState
						icon="coins"
						title="این بسته دیگر فروخته نمی‌شود"
						text="از بسته‌های فعلی یکی را انتخاب کن."
						action={
							<Link className="bd-action" href={R.coins}>
								بسته‌های سکه
							</Link>
						}
					/>
				</Panel>
			) : (
				<div className="rt-two">
					<Panel title="بستهٔ انتخاب‌شده">
						<div className="bd-coin-summary">
							<span className="bd-mission-icon bd-coin-icon" aria-hidden="true">
								<Icon name="coins" />
							</span>
							<strong className="rt-big">
								{fa(pack.coins)} <small>سکه</small>
							</strong>
							{pack.badge ? <span className="bd-tag">{pack.badge}</span> : null}
						</div>
						<p className="bd-muted">سکه‌ها بلافاصله بعد از تأیید پرداخت به کیف تو اضافه می‌شوند.</p>
					</Panel>
					<Panel title="خلاصهٔ پرداخت">
						<Facts
							items={[
								["تعداد سکه", `${fa(pack.coins)} سکه`],
								...(pack.original_price_toman && pack.discount_percent
									? ([
											["قیمت اصلی", <s key="o">{toman(pack.original_price_toman)}</s>],
											["تخفیف", `${toman(pack.discount_toman)} (${fa(pack.discount_percent)}٪)`],
										] as [string, ReactNode][])
									: []),
								["مبلغ قابل پرداخت", <b key="p">{toman(pack.price_toman)}</b>],
							]}
						/>
						{data.mode === "sandbox" ? <Notice tone="info">پرداخت در حالت آزمایشی است: پولی جابه‌جا نمی‌شود.</Notice> : null}
						{!data.open ? <Notice tone="info">خرید سکه فعلاً بسته است.</Notice> : null}
						{failed ? <Notice>{failed}</Notice> : null}
						<div className="bd-actions">
							<button type="button" className="bd-action" disabled={paying || !data.open} onClick={pay}>
								{paying ? "در حال اتصال به درگاه…" : `پرداخت ${toman(pack.price_toman)}`}
							</button>
							<Link className="bd-secondary" href={R.coins}>
								تغییر بسته
							</Link>
						</div>
						<small className="bd-muted">پرداخت از درگاه امن زیبال انجام می‌شود.</small>
					</Panel>
				</div>
			)}
		</AppShell>
	);
}

/**
 * Zibal's sandbox stand-in (COIN_ZIBAL_MODE = "sandbox"): no card, no money. It only says «paid» or
 * «cancelled» back, the way Zibal's page would.
 */
export function CoinSandboxPage() {
	const params = useSearchParams();
	const { replace } = useRouter();
	const trackId = params.get("trackId") ?? "";
	const amount = Number(params.get("amount") ?? 0);
	const back = (success: boolean) => replace(`${R.coins}/callback?trackId=${encodeURIComponent(trackId)}&success=${success ? 1 : 0}`);
	return (
		<AppShell nav="wallet" title="درگاه پرداخت آزمایشی">
			<Panel title="درگاه آزمایشی زیبال">
				<p>
					این صفحهٔ <b>آزمایشی</b> است: هیچ پولی جابه‌جا نمی‌شود و کارتی خواسته نمی‌شود. وقتی درگاه واقعی روشن شود، به‌جای این صفحه به
					زیبال می‌روی.
				</p>
				{amount ? (
					<Facts items={[["مبلغ", toman(amount)]]} />
				) : null}
				<div className="bd-actions">
					<button type="button" className="bd-action" disabled={!trackId} onClick={() => back(true)}>
						<Icon name="badge-check" /> پرداخت موفق (آزمایشی)
					</button>
					<button type="button" className="bd-secondary" disabled={!trackId} onClick={() => back(false)}>
						انصراف
					</button>
				</div>
			</Panel>
		</AppShell>
	);
}

/** Back from the gateway: the server checks the payment and credits the coins once. */
export function CoinCallbackPage() {
	const params = useSearchParams();
	const queryClient = useQueryClient();
	const sent = useRef(false);
	const [state, setState] = useState<{ purchase?: CoinPurchase; error?: string }>({});
	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		const trackId = params.get("trackId") ?? "";
		const success = params.get("success") === "1";
		verifyPurchase(trackId, success)
			.then((purchase) => {
				setState({ purchase });
				// The new balance everywhere (header, wallet, games).
				if (purchase.status === "paid") void queryClient.invalidateQueries();
			})
			.catch((e) => setState({ error: gameErrorMessage(e) }));
	}, [params, queryClient]);

	const p = state.purchase;
	const paid = p?.status === "paid";
	const pending = !p && !state.error;
	return (
		<AppShell nav="wallet" title="نتیجهٔ پرداخت">
			<Panel>
				{pending ? (
					<EmptyState icon="loader-circle" title="صبر کن…" text="در حال بررسی پرداخت…" />
				) : paid ? (
					<>
						<EmptyState icon="badge-check" title="خرید سکه انجام شد" />
						<Notice tone="ok">
							{fa(p.coins)} سکه به کیف تو اضافه شد.{p.balance !== null ? ` موجودی فعلی: ${fa(p.balance)} سکه.` : ""}
						</Notice>
						<Facts
							items={[
								["مبلغ پرداخت‌شده", toman(p.amount_toman)],
								...(p.ref_number ? ([["شمارهٔ پیگیری", <bdi key="r">{p.ref_number}</bdi>]] as [string, ReactNode][]) : []),
							]}
						/>
					</>
				) : (
					<>
						<EmptyState icon="circle-alert" title={p?.status === "cancelled" ? "پرداخت لغو شد" : "پرداخت انجام نشد"} />
						<Notice>
							{state.error ??
								(p?.status === "cancelled"
									? "پرداخت لغو شد و سکه‌ای اضافه نشد. هر وقت خواستی دوباره خرید کن."
									: "پرداخت تأیید نشد و موجودی تو تغییری نکرد. اگر مبلغی از حسابت کم شده، طبق قوانین بانک برمی‌گردد.")}
						</Notice>
					</>
				)}
				{!pending ? (
					<div className="bd-actions">
						<Link className="bd-action" href={R.wallet}>
							برگشت به کیف
						</Link>
						<Link className="bd-secondary" href={R.coins}>
							{paid ? "خرید دوباره" : "تلاش دوباره"}
						</Link>
					</div>
				) : null}
			</Panel>
		</AppShell>
	);
}
