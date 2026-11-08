"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { styleClass, useBdStyle } from "../appearance";
import {
	EmptyState,
	LoadState,
	Notice,
	Panel,
	R,
	useRequireLogin,
} from "../ui";
import { type GmProfile, type Intent, saveProfile, useGmProfile } from "./api";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

export const GM = {
	home: "/pwa/gm",
	games: "/pwa/gm/games",
	create: "/pwa/gm/new",
	game: (id: string) => `/pwa/gm/games/${id}`,
	settings: "/pwa/gm/settings",
} as const;

type GmNav = "home" | "games" | "create" | "settings";

const NAV: { key: GmNav; icon: IconName; label: string; href: string }[] = [
	{ key: "home", icon: "house", label: "داشبورد", href: GM.home },
	{ key: "games", icon: "list", label: "بازی‌های من", href: GM.games },
	{ key: "create", icon: "plus", label: "ساخت بازی", href: GM.create },
	{
		key: "settings",
		icon: "user-round",
		label: "تنظیمات سازنده",
		href: GM.settings,
	},
];

/** Back to Player Mode (the same session; the choice is remembered on the server). */
export function usePlayerSwitch() {
	const router = useRouter();
	const queryClient = useQueryClient();
	return async () => {
		try {
			await saveProfile({ preferred_mode: "player" });
		} finally {
			void queryClient.invalidateQueries();
			router.push(R.home);
		}
	};
}

const INTENTS: [Intent, string, string, IconName][] = [
	[
		"personal",
		"شخصی",
		"بازی برای تولد، سالگرد یا دوستان؛ فقط با لینک دعوت.",
		"gift",
	],
	[
		"business",
		"کسب‌وکار",
		"معما و QR برای اینکه مشتری به فروشگاهت بیاید.",
		"coffee",
	],
	[
		"pro",
		"سازندهٔ حرفه‌ای",
		"گنج‌یابی شهری، تور تعاملی و مسابقه برای همه.",
		"map-pin",
	],
];

/** The first time in Game Master: what it is, its rules, and what the creator wants to make. */
function Onboarding({ profile }: { profile: GmProfile }) {
	const queryClient = useQueryClient();
	const [step, setStep] = useState(0);
	const [intent, setIntent] = useState<Intent | "">(profile.intent);
	const [accept, setAccept] = useState(false);
	const [business, setBusiness] = useState(profile.business_name);
	const [phone, setPhone] = useState(profile.business_phone);
	const [problem, setProblem] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// Swipe between the steps like the app's onboarding: the finger moving left = next, right = back
	// (forward from the rules only once they are accepted).
	const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
	const canNext = step === 0 || (step === 1 && accept);
	const finish = async () => {
		setBusy(true);
		setProblem(null);
		try {
			await saveProfile({
				preferred_mode: "creator",
				intent: intent as Intent,
				accept_terms: true,
				business_name: business,
				business_phone: phone,
			});
			await queryClient.invalidateQueries();
		} catch (e) {
			setProblem(gameErrorMessage(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<Panel title="به گیم مستر خوش آمدی" className="gm-onboarding">
			<div
				className="gm-swipe"
				onPointerDown={(e) => {
					if (e.pointerType === "mouse" && e.button !== 0) return;
					if ((e.target as HTMLElement).closest("input,textarea,select"))
						return;
					swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
				}}
				onPointerUp={(e) => {
					const start = swipe.current;
					swipe.current = null;
					if (!start || start.id !== e.pointerId) return;
					const dx = e.clientX - start.x;
					if (
						Math.abs(dx) < 50 ||
						Math.abs(dx) < Math.abs(e.clientY - start.y) * 1.5
					)
						return;
					if (dx < 0 && canNext) setStep(step + 1);
					if (dx > 0 && step > 0) setStep(step - 1);
				}}
				onPointerCancel={() => {
					swipe.current = null;
				}}
			>
				<ol className="gm-steps" aria-label="مراحل معرفی">
					{["معرفی", "قوانین", "کاربرد"].map((t, i) => (
						<li
							key={t}
							aria-current={i === step ? "step" : undefined}
							data-done={i < step || undefined}
						>
							{t}
						</li>
					))}
				</ol>
				{step === 0 ? (
					<div className="gm-intro">
						<p>
							با گیم مستر بدون برنامه‌نویسی بازی می‌سازی: معمای تولد برای یک
							دوست، چالش QR برای مشتری‌های کافه‌ات، یا گنج‌یابی در شهر برای همه.
						</p>
						<ul>
							<li>
								<Icon name="puzzle" /> قالب انتخاب کن و مرحله‌ها را بچین؛ پرسش،
								معما، QR، موقعیت و جایزه.
							</li>
							<li>
								<Icon name="eye" /> قبل از ارسال، بازی را خودت امتحان کن.
							</li>
							<li>
								<Icon name="shield-check" /> هر بازی عمومی قبل از انتشار توسط
								بردینو بررسی و تأیید می‌شود.
							</li>
							<li>
								<Icon name="coins" /> امتیاز جایزهٔ بازیکنان از کیف امتیاز خودت
								کنار گذاشته می‌شود.
							</li>
						</ul>
						<button
							type="button"
							className="bd-action"
							onClick={() => setStep(1)}
						>
							ادامه <Icon name="arrow-left" />
						</button>
					</div>
				) : step === 1 ? (
					<div className="gm-terms">
						<ul>
							<li>
								بازی‌ها نباید شرط‌بندی، قمار یا جایزهٔ شانسی پولی داشته باشند.
							</li>
							<li>
								محل‌ها باید عمومی و امن باشند؛ نه خانهٔ شخصی، نه جای خطرناک یا
								ممنوع.
							</li>
							<li>
								متن و تصویر باید مناسب همه و بدون اطلاعات شخصی دیگران باشد.
							</li>
							<li>
								حق نشر (کپی‌رایت) را رعایت کن: متن، تصویر، صدا، نام و ایدهٔ بازی
								باید مال خودت باشد یا اجازهٔ استفاده‌اش را داشته باشی؛ مسئولیت
								محتوای کپی‌شده با سازنده است.
							</li>
							<li>
								بردینو می‌تواند هر بازی را رد، متوقف یا بایگانی کند؛ دلیلش به تو
								گفته می‌شود.
							</li>
							<li>
								امتیازی که برای جایزه کنار می‌گذاری به بازیکنان پرداخت می‌شود و
								باقی‌مانده در پایان بازی برمی‌گردد.
							</li>
						</ul>
						<label className="gm-check">
							<input
								type="checkbox"
								checked={accept}
								onChange={(e) => setAccept(e.target.checked)}
							/>{" "}
							قوانین گیم مستر را خواندم و می‌پذیرم.
						</label>
						<div className="bd-actions">
							<button
								type="button"
								className="bd-action"
								disabled={!accept}
								onClick={() => setStep(2)}
							>
								پذیرفتم
							</button>
							<button
								type="button"
								className="bd-secondary"
								onClick={() => setStep(0)}
							>
								قبلی
							</button>
						</div>
					</div>
				) : (
					<div className="gm-intent">
						<p>
							بیشتر برای چه بازی می‌سازی؟ بعداً هم هر نوع بازی را می‌توانی
							بسازی.
						</p>
						<div
							className="gm-choice-grid"
							role="radiogroup"
							aria-label="کاربرد"
						>
							{INTENTS.map(([value, label, text, icon]) => (
								<button
									key={value}
									type="button"
									role="radio"
									aria-checked={intent === value}
									className="gm-choice"
									onClick={() => setIntent(value)}
								>
									<Icon name={icon} />
									<b>{label}</b>
									<small>{text}</small>
								</button>
							))}
						</div>
						{intent === "business" || intent === "pro" ? (
							<div className="gm-fields">
								<label className="rt-field">
									<span>
										{intent === "business" ? "نام کسب‌وکار" : "نام سازنده"}
									</span>
									<input
										value={business}
										maxLength={120}
										onChange={(e) => setBusiness(e.target.value)}
										placeholder="به بازیکنان نشان داده می‌شود"
									/>
								</label>
								{intent === "business" ? (
									<label className="rt-field">
										<span>تلفن کسب‌وکار (اختیاری)</span>
										<input
											value={phone}
											maxLength={20}
											inputMode="tel"
											dir="ltr"
											onChange={(e) => setPhone(e.target.value)}
										/>
									</label>
								) : null}
							</div>
						) : null}
						{problem ? <Notice>{problem}</Notice> : null}
						<div className="bd-actions">
							<button
								type="button"
								className="bd-action"
								disabled={
									!intent ||
									busy ||
									((intent === "business" || intent === "pro") &&
										!business.trim())
								}
								onClick={() => void finish()}
							>
								{busy ? (
									<Icon name="loader-circle" className="bd-spin" />
								) : null}{" "}
								ورود به گیم مستر
							</button>
							<button
								type="button"
								className="bd-secondary"
								onClick={() => setStep(1)}
							>
								قبلی
							</button>
						</div>
					</div>
				)}
			</div>
		</Panel>
	);
}

/**
 * The Game Master workspace: its own header and navigation, inside the same app and session. Shows the
 * first-time introduction until the creator has finished it.
 */
export default function CreatorShell({
	nav,
	title,
	children,
	actions,
}: {
	nav?: GmNav;
	title: string;
	children: ReactNode;
	actions?: ReactNode;
}) {
	const loggedIn = useRequireLogin();
	const st = styleClass(useBdStyle());
	const { data, isLoading, error, refetch } = useGmProfile();
	const toPlayer = usePlayerSwitch();
	const profile = data?.result?.profile;
	useEffect(() => {
		document.title = `${title} | گیم مستر بردینو`;
	}, [title]);
	if (!loggedIn) return null;
	let body: ReactNode = children;
	if (!profile)
		body = <LoadState loading={isLoading} error={error} onRetry={refetch} />;
	else if (!profile.available)
		body = (
			<EmptyState
				icon="lock-keyhole"
				title="گیم مستر هنوز برای همه باز نیست"
				text="به‌زودی باز می‌شود؛ تا آن موقع در حالت بازیکن بازی کن."
				action={
					<button
						type="button"
						className="bd-action"
						onClick={() => void toPlayer()}
					>
						حالت بازیکن
					</button>
				}
			/>
		);
	else if (profile.blocked)
		body = (
			<EmptyState
				icon="ban"
				title="حساب سازنده مسدود است"
				text="برای پیگیری با پشتیبانی بردینو تماس بگیر."
			/>
		);
	else if (!profile.onboarded) body = <Onboarding profile={profile} />;
	return (
		<article
			className={`bd-product bd-app rt-product ${st} lay-1 bd-page gm-product`}
			aria-label={title}
		>
			<header className="bd-app-top">
				<Link href={GM.home} className="bd-brand">
					<span className="bd-logomark" aria-hidden="true">
						ب
					</span>
					گیم مستر
				</Link>
				<button
					type="button"
					className="bd-secondary gm-mode-switch"
					onClick={() => void toPlayer()}
				>
					<Icon name="gamepad-2" /> حالت بازیکن
				</button>
			</header>
			<div className="bd-shell">
				{profile?.onboarded ? (
					<nav className="bd-sidebar" aria-label="ناوبری گیم مستر">
						{NAV.map((item) => (
							<Link
								key={item.key}
								href={item.href}
								className="bd-nav-item"
								aria-current={item.key === nav ? "page" : undefined}
							>
								<Icon name={item.icon} />
								{item.label}
							</Link>
						))}
					</nav>
				) : null}
				<main className="bd-dash rt-content" id="main">
					<div className="rt-page-heading">
						<div>
							<p className="bd-muted">گیم مستر / {title}</p>
							<h2>{title}</h2>
						</div>
						{profile?.onboarded ? actions : null}
					</div>
					<div className="rt-page-body">{body}</div>
				</main>
			</div>
		</article>
	);
}
