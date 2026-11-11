"use client";

import { useEffect } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { GAMES } from "../games";
import { useGmProfile } from "../gm/api";
import { fa } from "../format";
import useCountdown, { formatLeft } from "../useCountdown";
import { AppShell, Art, Balance, LoadState, R, useProfileSync } from "../ui";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";

function LotteryPanel() {
	const { activeLotteries: lottery, loaded, isLoading, error, refetch } = useExtractLotteries();
	const left = useCountdown(lottery?.end_date);
	if (!lottery && !loaded) {
		// Still loading, or the list failed: not the same as «no lottery right now».
		return (
			<section className="bd-panel bd-campaign">
				<p className="bd-overline">
					<Icon name="ticket" /> قرعه‌کشی بردینو
				</p>
				<LoadState loading={isLoading} error={error} onRetry={refetch} errorText="قرعه‌کشی‌ها بارگذاری نشد." />
			</section>
		);
	}
	if (!lottery) {
		return (
			<section className="bd-panel bd-campaign">
				<p className="bd-overline">
					<Icon name="ticket" /> قرعه‌کشی بردینو
				</p>
				<h3>منتظر دورهٔ بعدی باش</h3>
				<p>در حال حاضر قرعه‌کشی فعالی وجود ندارد. دورهٔ بعدی به‌زودی اعلام می‌شود.</p>
				<Link className="bd-action" href={R.wallet}>
					مشاهدهٔ کیف‌پول <Icon name="arrow-right" />
				</Link>
			</section>
		);
	}
	return (
		<section className="bd-panel bd-campaign">
			<p className="bd-overline">
				<Icon name="ticket" /> قرعه‌کشی بردینو
			</p>
			<h3>{lottery.name}</h3>
			<p>
				جایزه: {fa(lottery.balance_in_money)} تومان
				<br />
				{left > 0 ? <>زمان باقی‌مانده: {formatLeft(left)}</> : <>فروش بسته شد؛ در انتظار قرعه‌کشی</>}
			</p>
			<Link className="bd-action" href={R.lotteryDetail(lottery.id)}>
				جزئیات و خرید بلیت <Icon name="arrow-right" />
			</Link>
		</section>
	);
}

/**
 * The app opens in the mode the player last chose («حالت برنامه»): once per session, a creator who
 * left the app in Game Master is taken back there (going to Player Mode stays where it is).
 */
function useRestoreMode() {
	const { replace } = useRouter();
	const mode = useGmProfile().data?.result?.profile;
	useEffect(() => {
		if (!mode || mode.preferred_mode !== "creator" || !mode.available) return;
		try {
			if (sessionStorage.getItem("bd-mode-restored")) return;
			sessionStorage.setItem("bd-mode-restored", "1");
		} catch {
			return;
		}
		replace(R.gm);
	}, [mode, replace]);
}

export default function Home() {
	const { profile } = useProfileSync();
	useRestoreMode();
	const streak = Number(profile?.consecutive_active_days ?? 0);
	return (
		<AppShell
			nav="home"
			title="خانه"
			heading={
				<div className="bd-dash-head">
					<div>
						<p>خانه / سرگرمی‌های امروز</p>
						<h2>امروز چه کار می‌کنی؟</h2>
					</div>
					<Balance />
				</div>
			}
		>
			<section className="bi-welcome">
				<div>
					<h3>یک چالش برای وقت آزاد</h3>
					<p>بازی دلخواهت را پیدا کن و راهنمایش را ببین.</p>
					<Link className="bd-action" href={R.games}>
						کشف بازی‌ها
					</Link>
				</div>
				<Art name="hero" eager />
			</section>
			<div className="bd-dashboard-grid">
				<section className="bd-panel bd-missions">
					<div className="bd-panel-head">
						<h3>گیمنت بردینو</h3>
						<span className="bd-tag">{fa(GAMES.length)} بازی</span>
					</div>
					<div className="bd-mission-list">
						{GAMES.map((game) => (
							// The whole row opens the game (not only its arrow).
							<Link className="bd-mission bd-mission-link" key={game.id} href={game.href} aria-label={`بازی ${game.name}: ${game.blurb}`}>
								<span className={`bd-mission-icon ${game.logo ? "bd-mission-logo" : ""}`}>
									{game.logo ? <img src={game.logo} alt="" width={36} height={36} /> : <Icon name={game.icon} />}
								</span>
								<span className="bd-mission-copy">
									<b>{game.name}</b>
									<small>{game.blurb}</small>
								</span>
								<span className="bd-mission-go" aria-hidden="true">
									<Icon name="arrow-right" />
								</span>
							</Link>
						))}
					</div>
					<Link className="bd-text-btn" href={R.games}>
						مشاهدهٔ همهٔ بازی‌ها →
					</Link>
				</section>
				<LotteryPanel />
				<section className="bd-panel bd-wheel-panel">
					<div className="bd-wheel" aria-hidden="true" />
					<div className="bd-wheel-copy">
						<h3>گردونهٔ بردینو</h3>
						<small>یک انتخاب دیگر برای سکه‌هایت</small>
						<Link className="bd-text-btn" href={R.wheel}>
							دیدن گردونه →
						</Link>
					</div>
				</section>
			</div>
			<section className="bd-panel bd-progress-panel">
				<div>
					<h3>چند لحظه سرگرمی</h3>
					<small className="bd-muted">بخش‌های سرگرمی بردینو</small>
				</div>
				<div className="bd-actions" style={{ marginTop: 0 }}>
					<Link className="bd-secondary" href={R.hafez}>
						<Icon name="book-open" /> فال حافظ
					</Link>
					<Link className="bd-secondary" href={R.tarot}>
						<Icon name="sparkles" /> فال تاروت
					</Link>
				</div>
			</section>
			<section className="bd-detail" aria-live="polite">
				<h3>{streak > 0 ? `${fa(streak)} روز پشت سر هم با بردینو` : "بازی بعدی را انتخاب کن."}</h3>
				<p>
					{streak > 0
						? `بیشترین همراهی پیوستهٔ تو: ${fa(profile?.max_consecutive_days ?? streak)} روز. فردا هم سر بزن تا زنجیره ادامه پیدا کند.`
						: "هر روز که سر بزنی، به روزهای پیوستهٔ همراهی‌ات اضافه می‌شود."}
				</p>
			</section>
		</AppShell>
	);
}
