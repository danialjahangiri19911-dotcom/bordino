"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { useBdStyle } from "../appearance";
import Icon from "../Icon";
import { BadgeArt, type BadgeFacts, badgeStates } from "../achievements";
import {
	type NotificationPrefs,
	PREFS_URL,
	appPush,
	currentSubscription,
	deviceSupport,
	disableOnThisDevice,
	enableAppPush,
	enableOnThisDevice,
	permission,
	savePrefs,
	sendTest,
} from "../push";
import { fa } from "../format";
import { type Entry, HistoryRow, PartialHistoryNotice, withSummary, rowsOf } from "../history";
import { AppShell, CopyButton, EmptyState, Facts, LoadState, Notice, Panel, R, usePoints, useProfileSync } from "../ui";
import { useCashAccount } from "./Wallet";

import { gameErrorMessage } from "@/api/games/request";
import useWalletHistory from "@/api/wallet/hooks/useWalletHistory";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import signOut from "@/libs/http/signOut";
import useThemeModeStore, { type Appearance, type BdStyle } from "@/libs/uiHooks/useThemeModeStore";

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
						می‌شود. بردینو رمز عبور ندارد؛ کد را به کسی نده.
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

const CATEGORIES = [
	["lottery", "خبرهای قرعه‌کشی", "دورهٔ تازه و اعلام نتیجهٔ قرعه‌کشی‌هایی که بلیت داری"],
	["account", "اطلاعیه‌های حساب", "تأیید حساب بانکی و واریز یا برگشت برداشت"],
	["games", "خبرهای بازی‌ها", "بازی‌ها و تجربه‌های تازه"],
] as const;
type CategoryKey = (typeof CATEGORIES)[number][0];

/** This device: can it receive notifications, and is it registered? */
function DevicePanel({ prefs, device, onEnable, onDisable, busy }: {
	prefs: NotificationPrefs;
	device: "checking" | "on" | "off" | "blocked";
	onEnable: () => void;
	onDisable: () => void;
	busy: boolean;
}) {
	const support = deviceSupport();
	const [test, setTest] = useState<string | null>(null);
	if (support !== "app" && !prefs.push_available) return <Notice tone="info">ارسال اعلان روی سرور بردینو هنوز روشن نشده است؛ انتخاب‌هایت ذخیره می‌شود و از همان روز اعمال می‌شود.</Notice>;
	if (support === "android-app")
		return <Notice tone="info">این نسخهٔ برنامه اعلان نمی‌گیرد. نسخهٔ تازهٔ برنامهٔ اندروید را از صفحهٔ اول بردینو دانلود و نصب کن؛ انتخاب‌هایت ذخیره است.</Notice>;
	if (support === "app" && !prefs.app_push_available)
		return <Notice tone="info">ارسال اعلان به برنامهٔ اندروید هنوز روی سرور بردینو روشن نشده است؛ انتخاب‌هایت ذخیره می‌شود و از همان روز اعمال می‌شود.</Notice>;
	if (support === "ios-install") return <Notice tone="info">در آیفون اعلان فقط برای برنامهٔ نصب‌شده کار می‌کند: بردینو را از Safari با «Add to Home Screen» نصب کن و از همان‌جا اعلان را روشن کن.</Notice>;
	if (support === "unsupported") return <Notice tone="info">این مرورگر اعلان وب را پشتیبانی نمی‌کند؛ بردینو را در Chrome، Firefox یا Edge باز کن.</Notice>;
	if (device === "blocked")
		return support === "app" ? (
			<Notice>اعلان‌های بردینو در تنظیمات اندروید خاموش است. از «تنظیمات گوشی ← برنامه‌ها ← بردینو ← اعلان‌ها» روشنش کن و این صفحه را دوباره باز کن.</Notice>
		) : (
			<Notice>اعلان‌های بردینو در تنظیمات این مرورگر مسدود است. از تنظیمات سایت (آیکن قفل کنار آدرس) «اعلان‌ها» را مجاز کن و این صفحه را دوباره باز کن.</Notice>
		);
	return (
		<div className="rt-setting bd-device-push">
			<span>
				<b>اعلان روی این دستگاه</b>
				<small>{device === "on" ? "روشن است؛ اعلان‌هایی که بالا انتخاب کرده‌ای به همین دستگاه می‌آید." : device === "checking" ? "در حال بررسی…" : "خاموش است؛ برای دریافت اعلان روشنش کن."}</small>
				{test ? <small role="status">{test}</small> : null}
			</span>
			{device === "on" ? (
				<span className="bd-device-actions">
					<button
						type="button"
						className="bd-text-btn"
						disabled={busy}
						onClick={async () => {
							setTest("در حال ارسال…");
							try {
								const r = await sendTest();
								setTest(r.delivered ? "اعلان آزمایشی فرستاده شد." : "اعلانی نرسید؛ دستگاه را دوباره روشن کن.");
							} catch (e) {
								setTest(gameErrorMessage(e));
							}
						}}
					>
						اعلان آزمایشی
					</button>
					<button type="button" className="bd-text-btn" disabled={busy} onClick={onDisable}>
						خاموش کردن
					</button>
				</span>
			) : (
				<button type="button" className="bd-action" disabled={busy || device === "checking"} onClick={onEnable}>
					روشن کردن
				</button>
			)}
		</div>
	);
}

export function Notifications() {
	const { data, isLoading, error, refetch } = useQuery<ResponseApiData<NotificationPrefs>>({ url: PREFS_URL, headers: true });
	const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
	const prefsRef = useRef<NotificationPrefs | null>(null);
	prefsRef.current = prefs;
	const [saving, setSaving] = useState<Partial<Record<CategoryKey, boolean>>>({});
	/** The newest change per switch: an older answer arriving late must not overwrite it. */
	const latest = useRef<Partial<Record<CategoryKey, number>>>({});
	const [device, setDevice] = useState<"checking" | "on" | "off" | "blocked">("checking");
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	useEffect(() => {
		if (data?.result) setPrefs(data.result);
	}, [data?.result]);
	useEffect(() => {
		let alive = true;
		(async () => {
			const support = deviceSupport();
			if (support === "app") {
				// On when this phone's Pushe id is one the server has for the player, and Android allows it.
				const st = await appPush()?.status().catch(() => null);
				if (!alive || !st) return alive && setDevice("off");
				if (st.permission === "denied") return setDevice("blocked");
				setDevice(st.deviceId && prefsRef.current?.app_device_ids?.includes(st.deviceId) ? "on" : "off");
				return;
			}
			if (support !== "ok") return alive && setDevice("off");
			if (permission() === "denied") return alive && setDevice("blocked");
			const sub = await currentSubscription().catch(() => null);
			if (alive) setDevice(sub ? "on" : "off");
		})();
		return () => {
			alive = false;
		};
	}, [prefs !== null]); // eslint-disable-line react-hooks/exhaustive-deps

	const enable = async () => {
		if (deviceSupport() === "app") {
			setBusy(true);
			setProblem(null);
			try {
				await enableAppPush();
				setDevice("on");
			} catch (e) {
				const code = (e as { code?: string })?.code;
				if (code === "DENIED") setDevice("blocked");
				else setProblem(code === "TIMEOUT" ? "ثبت این گوشی در سرویس اعلان طول کشید؛ اینترنت را بررسی کن و دوباره امتحان کن." : `روشن کردن اعلان نشد: ${gameErrorMessage(e)}`);
			} finally {
				setBusy(false);
			}
			return;
		}
		if (!prefs?.vapid_public_key) return;
		setBusy(true);
		setProblem(null);
		try {
			const answer = await enableOnThisDevice(prefs.vapid_public_key);
			setDevice(answer === "granted" ? "on" : answer === "denied" ? "blocked" : "off");
		} catch (e) {
			setProblem(`روشن کردن اعلان روی این دستگاه نشد: ${gameErrorMessage(e)}`);
		} finally {
			setBusy(false);
		}
	};
	const disable = async () => {
		setBusy(true);
		setProblem(null);
		try {
			await disableOnThisDevice();
			setDevice("off");
		} catch (e) {
			// Still on: say so instead of showing «off».
			setDevice((await currentSubscription().catch(() => null)) ? "on" : "off");
			setProblem(`خاموش کردن اعلان روی این دستگاه نشد: ${gameErrorMessage(e)}`);
		} finally {
			setBusy(false);
		}
	};

	const toggle = async (key: CategoryKey, value: boolean) => {
		if (!prefs) return;
		const previous = prefs[key];
		const seq = (latest.current[key] ?? 0) + 1;
		latest.current[key] = seq;
		const newest = () => latest.current[key] === seq;
		// Only this switch changes: another switch saved meanwhile keeps its own answer.
		setPrefs((p) => (p ? { ...p, [key]: value } : p));
		setSaving((s) => ({ ...s, [key]: true }));
		setProblem(null);
		// Turning something on also asks this device (the browser wants the request straight from the tap).
		const support = deviceSupport();
		const asking =
			value && device === "off" && ((support === "ok" && prefs.push_available && prefs.vapid_public_key && permission() === "default") || (support === "app" && prefs.app_push_available))
				? enable()
				: null;
		try {
			const saved = await savePrefs({ [key]: value });
			if (newest()) setPrefs((p) => (p ? { ...p, [key]: saved[key] } : saved));
		} catch (e) {
			if (newest()) {
				setPrefs((p) => (p ? { ...p, [key]: previous } : p));
				setProblem(`ذخیره نشد: ${gameErrorMessage(e)}`);
			}
		} finally {
			if (newest()) setSaving((s) => ({ ...s, [key]: false }));
		}
		await asking;
	};

	return (
		<AppShell nav="profile" title="مدیریت اعلانات">
			<Panel title="چه اعلان‌هایی دریافت می‌کنی؟">
				{!prefs ? (
					<LoadState loading={isLoading} error={error} onRetry={refetch} />
				) : (
					<>
						{CATEGORIES.map(([key, title, text]) => (
							<label className="rt-setting" key={key}>
								<span>
									<b>{title}</b>
									<small>{text}</small>
								</span>
								<input
									type="checkbox"
									checked={prefs[key]}
									disabled={!!saving[key]}
									aria-busy={!!saving[key]}
									onChange={(e) => void toggle(key, e.currentTarget.checked)}
								/>
							</label>
						))}
						{problem ? <Notice>{problem}</Notice> : null}
					</>
				)}
			</Panel>
			{prefs ? (
				<Panel title="این دستگاه" className="rt-gap-top">
					<DevicePanel prefs={prefs} device={device} onEnable={() => void enable()} onDisable={() => void disable()} busy={busy} />
				</Panel>
			) : null}
		</AppShell>
	);
}

const THEMES: [Appearance, string, string][] = [
	["light", "روشن", "swatch-light"],
	["dark", "تیره", "swatch-dark"],
	["system", "مطابق دستگاه", "swatch-auto"],
];

/** The design styles: neobrutalism (the default), neon (always dark), neumorphism. */
const STYLES: [BdStyle, string, string][] = [
	["brutal", "نئوبروتال", "پوستر قرمز؛ خط‌های پررنگ"],
	["neon", "نئونی", "نبض بنفش؛ همیشه تیره"],
	["neu", "نرم", "نرم و روشن؛ سایه‌های ملایم"],
];

export function AppearancePage() {
	const { mode, setMode, style, setStyle } = useThemeModeStore();
	const bdStyle = useBdStyle();
	const neon = bdStyle === "neon";
	return (
		<AppShell nav="profile" title="ظاهر برنامه">
			<Panel title="طرح برنامه">
				<div className="rt-style-options" role="radiogroup" aria-label="طرح برنامه">
					{STYLES.map(([value, label, note]) => (
						<button
							key={value}
							type="button"
							className="rt-style-option"
							role="radio"
							aria-checked={style === value}
							onClick={() => setStyle(value)}
						>
							<span className={`rt-style-swatch sw-${value}`} aria-hidden="true">
								<i />
								<i />
								<i />
							</span>
							<b>{label}</b>
							<small>{note}</small>
						</button>
					))}
				</div>
				<small className="bd-muted">طرح همهٔ صفحه‌ها و بازی‌ها عوض می‌شود؛ امتیاز و حسابت همان می‌ماند.</small>
			</Panel>
			<Panel title="روشن یا تیره">
				<div className="rt-theme-options" role="radiogroup" aria-label="روشن یا تیره">
					{THEMES.map(([value, label, swatch]) => (
						<button
							key={value}
							type="button"
							className="rt-theme-option"
							role="radio"
							aria-checked={neon ? value === "dark" : mode === value}
							aria-pressed={neon ? value === "dark" : mode === value}
							aria-disabled={neon && value !== "dark"}
							onClick={() => !neon && setMode(value)}
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
				<small className="bd-muted">
					{neon ? "طرح نئونی همیشه تیره است. " : ""}انتخاب روی همین دستگاه ذخیره می‌شود و برای همهٔ صفحه‌ها اعمال می‌شود.
				</small>
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
					<>
						<PartialHistoryNotice
							parts={[
								{ label: "امتیاز", history: withSummary(p, points) },
								{ label: "نقدی", history: withSummary(c, cash) },
							]}
						/>
						<div className="bd-rows">
							{prizes.map((entry) => (
								<HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
							))}
						</div>
					</>
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

function Badges({ facts }: { facts: BadgeFacts }) {
	const states = badgeStates(facts);
	const earned = states.filter((x) => x.unlocked).length;
	return (
		<Panel title={`نشان‌ها · ${fa(earned)} از ${fa(states.length)}`} className="rt-gap-top">
			<ul className="bd-badges">
				{states.map(({ badge, unlocked, progress }) => (
					<li key={badge.id} className={`bd-badge${unlocked ? " is-unlocked" : ""}`}>
						<BadgeArt id={badge.id} locked={!unlocked} />
						<b>{badge.title}</b>
						<small>{badge.goalText}</small>
						{unlocked ? (
							<span className="bd-tag bd-badge-done">
								<Icon name="check" /> به دست آمد
							</span>
						) : (
							<span className="bd-badge-progress">
								<span className="bd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={badge.goal} aria-valuenow={progress} aria-label={`پیشرفت «${badge.title}»`}>
									<i style={{ width: `${(progress / badge.goal) * 100}%` }} />
								</span>
								<small>
									{fa(progress)} از {fa(badge.goal)}
								</small>
							</span>
						)}
					</li>
				))}
			</ul>
		</Panel>
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
					<Badges
						facts={{
							bestStreak: Number(profile.max_consecutive_days) || 0,
							tickets: profile.tickets_total ?? points.account?.total_tickets ?? 0,
							friends: profile.referral_count ?? 0,
							hasPhoto: !!profile.image_url,
						}}
					/>
				</>
			)}
		</AppShell>
	);
}
