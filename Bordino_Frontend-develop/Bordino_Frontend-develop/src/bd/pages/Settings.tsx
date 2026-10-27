"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { fa } from "../format";
import { type Entry, HistoryRow, rowsOf } from "../history";
import { AppShell, CopyButton, EmptyState, Facts, LoadState, Notice, Panel, R, usePoints, useProfileSync } from "../ui";
import { useCashAccount } from "./Wallet";

import useWalletHistory from "@/api/wallet/hooks/useWalletHistory";
import signOut from "@/libs/http/signOut";
import useThemeModeStore, { type Appearance } from "@/libs/uiHooks/useThemeModeStore";

export function Security() {
	const { profile } = useProfileSync();
	const [leaving, setLeaving] = useState(false);
	const phone = profile?.phone_number ? `0${profile.phone_number}` : "";
	return (
		<AppShell nav="profile" title="ورود و امنیت">
			<div className="rt-two">
				<Panel title="روش ورود">
					<div className="rt-security-icon">
						<Icon name="shield-check" />
					</div>
					<h3>ورود با شمارهٔ همراه</h3>
					<p>
						هر بار با کد یک‌بارمصرفی وارد می‌شوی که به شمارهٔ <bdi dir="ltr">{phone.replace(/^(\d{4})\d{3}(\d{4})$/, "$1•••$2")}</bdi> پیامک
						می‌شود. بوردینو رمز عبور ندارد؛ کد را به کسی نده.
					</p>
				</Panel>
				<Panel title="این دستگاه">
					<div className="rt-setting">
						<span>
							<b>نشست فعلی</b>
							<small>همین مرورگر</small>
						</span>
						<span className="bd-tag">فعلی</span>
					</div>
					<p className="bd-muted">با خروج، نشست این دستگاه در سرور هم بسته می‌شود.</p>
					<button
						type="button"
						className="bd-secondary"
						disabled={leaving}
						onClick={() => {
							setLeaving(true);
							signOut();
						}}
					>
						{leaving ? "در حال خروج…" : "خروج از حساب"}
					</button>
				</Panel>
			</div>
		</AppShell>
	);
}

export function Notifications() {
	return (
		<AppShell nav="profile" title="مدیریت اعلانات">
			<Panel title="چه اعلان‌هایی دریافت می‌کنی؟">
				<Notice tone="info">بوردینو هنوز اعلان (پوش یا پیامک خبری) نمی‌فرستد؛ این تنظیمات با راه‌اندازی اعلان‌ها فعال می‌شوند.</Notice>
				{(
					[
						["خبرهای قرعه‌کشی", "اعلام دوره‌های جدید و نتیجه‌ها"],
						["اطلاعیه‌های حساب", "پیام‌های مرتبط با کیف‌پول و امنیت"],
						["خبرهای بازی‌ها", "بازی‌ها و تجربه‌های تازه"],
					] as const
				).map(([title, text]) => (
					<label className="rt-setting" key={title}>
						<span>
							<b>{title}</b>
							<small>{text}</small>
						</span>
						<input type="checkbox" disabled aria-label={`${title} (هنوز فعال نیست)`} />
					</label>
				))}
			</Panel>
		</AppShell>
	);
}

const THEMES: [Appearance, string, string][] = [
	["light", "روشن", "swatch-light"],
	["dark", "تیره", "swatch-dark"],
	["system", "مطابق دستگاه", "swatch-auto"],
];

export function AppearancePage() {
	const { mode, setMode } = useThemeModeStore();
	return (
		<AppShell nav="profile" title="ظاهر برنامه">
			<Panel title="ظاهر دلخواه تو">
				<div className="rt-theme-options" role="radiogroup" aria-label="ظاهر برنامه">
					{THEMES.map(([value, label, swatch]) => (
						<button
							key={value}
							type="button"
							className="rt-theme-option"
							role="radio"
							aria-checked={mode === value}
							aria-pressed={mode === value}
							onClick={() => setMode(value)}
						>
							<span className={`rt-theme-swatch ${swatch}`}>
								<i />
								<i />
								<i />
							</span>
							{label}
						</button>
					))}
				</div>
				<small className="bd-muted">انتخاب روی همین دستگاه ذخیره می‌شود و برای همهٔ صفحه‌ها اعمال می‌شود.</small>
			</Panel>
		</AppShell>
	);
}

const PRIZE_TYPES = new Set(["wheel_prize", "lottery_prize"]);

export function Prizes() {
	const points = usePoints();
	const cash = useCashAccount();
	const p = useWalletHistory("points", points.account?.id);
	const c = useWalletHistory("currency", cash.account?.id);
	const prizes: Entry[] = useMemo(
		() =>
			[...rowsOf(p.data?.pages, "points"), ...rowsOf(c.data?.pages, "currency")]
				.filter((row) => PRIZE_TYPES.has(row.type))
				.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
		[p.data, c.data],
	);
	const loading = p.isLoading || c.isLoading;
	const failed = p.isError || c.isError;
	const more = p.hasNextPage || c.hasNextPage;
	return (
		<AppShell nav="profile" title="تاریخچهٔ جوایز">
			<Panel title="جوایز من">
				{prizes.length ? (
					<div className="bd-rows">
						{prizes.map((entry) => (
							<HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
						))}
					</div>
				) : loading || failed ? (
					<LoadState loading={loading} error={failed} onRetry={() => (p.isError ? p.refetch() : c.refetch())} />
				) : !more ? (
					<EmptyState
						art="rewards"
						title="هنوز جایزه‌ای ثبت نشده"
						text="جایزه‌های گردونه و قرعه‌کشی و وضعیت دریافت آن‌ها اینجا نمایش داده می‌شوند."
						action={
							<Link className="bd-secondary" href={R.home}>
								بازگشت به خانه
							</Link>
						}
					/>
				) : (
					<p className="bd-muted">در تراکنش‌های اخیر جایزه‌ای نبود؛ تراکنش‌های قدیمی‌تر را هم ببین.</p>
				)}
				{more ? (
					<button
						type="button"
						className="bd-secondary bd-more"
						disabled={p.isFetchingNextPage || c.isFetchingNextPage}
						onClick={() => {
							if (p.hasNextPage) p.fetchNextPage();
							if (c.hasNextPage) c.fetchNextPage();
						}}
					>
						{p.isFetchingNextPage || c.isFetchingNextPage ? "در حال بارگذاری…" : "جست‌وجو در تراکنش‌های قدیمی‌تر"}
					</button>
				) : null}
			</Panel>
		</AppShell>
	);
}

export function Achievements() {
	const { profile, isLoading, error, refetch } = useProfileSync();
	const points = usePoints();
	return (
		<AppShell nav="profile" title="دستاوردها">
			{!profile ? (
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
			) : (
				<>
					<div className="rt-three">
						<Panel title="همراهی پیوسته">
							<div className="rt-achievement">
								<Icon name="calendar-check" />
							</div>
							<p>{fa(profile.consecutive_active_days)} روز پشت سر هم</p>
							<span className="bd-tag">رکورد: {fa(profile.max_consecutive_days)} روز</span>
						</Panel>
						<Panel title="بلیت‌های فعال">
							<div className="rt-achievement">
								<Icon name="ticket" />
							</div>
							<p>{fa(points.account?.total_tickets ?? 0)} بلیت در دورهٔ جاری</p>
							<Link className="bd-tag" href={R.lotteries}>
								قرعه‌کشی‌ها
							</Link>
						</Panel>
						<Panel title="دعوت از دوستان">
							<div className="rt-achievement">
								<Icon name="users" />
							</div>
							<p>{fa(profile.referral_count ?? 0)} نفر با کد تو آمده‌اند</p>
							{profile.referral_code ? (
								<span className="bd-code">
									<span className="bd-tag">
										کد تو: <bdi dir="ltr">{profile.referral_code}</bdi>
									</span>
									<CopyButton text={profile.referral_code} label="کپی کد معرف" />
								</span>
							) : null}
						</Panel>
					</div>
					<Panel title="نشان‌ها" className="rt-gap-top">
						<Facts items={[["وضعیت", "نشان‌ها و جایزه‌های دستاورد به‌زودی اضافه می‌شوند"]]} />
					</Panel>
				</>
			)}
		</AppShell>
	);
}
