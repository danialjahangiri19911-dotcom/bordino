"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import Icon, { type IconName } from "./Icon";
import { styleClass, useBdStyle } from "./appearance";
import { confirmLeave } from "./back";
import { useDismissOutside } from "./dismiss";
import { fa } from "./format";
import { takePendingQr } from "./missions/pendingQr";
import { reconcilePushOwner } from "./push";
import useGetCustomerProfile from "@api/customer/hooks/useGetCustomerProfile";
import useGetPointsSummary from "@api/wallet/hooks/useGetPointsSummary";

import useAuthStore from "@/libs/stores/authStore";
import useUserStore from "@/libs/stores/userStore";

export const R = {
	landing: "/",
	home: "/pwa/main",
	games: "/pwa/gameNet",
	earn: "/pwa/earn",
	earnQr: (token: string) => `/pwa/earn/qr/${token}`,
	mystery: (id: string) => `/pwa/earn/mystery/${id}`,
	wallet: "/pwa/wallet",
	transactions: "/pwa/wallet/transactions",
	withdraw: "/pwa/wallet/withdraw",
	tickets: "/pwa/wallet/tickets",
	lotteries: "/pwa/lottery",
	lotteryDetail: (id: string) => `/pwa/lottery/lottery-detail/${id}`,
	lotteryGuide: "/pwa/lottery/guide",
	buyTicket: "/pwa/lottery/buy-ticket",
	ticketDetail: (id: string) => `/pwa/lottery/ticket-detail/${id}`,
	profile: "/pwa/profile",
	personal: "/pwa/profile/personal",
	security: "/pwa/profile/security",
	notifications: "/pwa/profile/notifications",
	appearance: "/pwa/profile/appearance",
	prizes: "/pwa/profile/prizes",
	achievements: "/pwa/profile/achievements",
	rules: "/pwa/rules",
	login: "/pwa/register",
	otp: "/pwa/otp",
	onboarding: "/pwa/onboarding",
	wheel: "/pwa/wheel",
	sudoku: "/pwa/sudoku",
	game2048: "/pwa/2048",
	crash: "/pwa/crash",
	chicken: "/pwa/chicken",
	pantomime: "/pwa/pantomime",
	hafez: "/pwa/hafez",
	tarot: "/pwa/tarot",
} as const;

type NavKey = "home" | "games" | "earn" | "wallet" | "profile";

const NAV: { key: NavKey; icon: IconName; label: string; href: string }[] = [
	{ key: "home", icon: "house", label: "خانه", href: R.home },
	{ key: "games", icon: "gamepad-2", label: "گیمنت", href: R.games },
	{ key: "earn", icon: "coins", label: "دریافت امتیاز", href: R.earn },
	{ key: "wallet", icon: "wallet", label: "کیف‌پول", href: R.wallet },
	{ key: "profile", icon: "user-round", label: "پروفایل", href: R.profile },
];

export function Brand({ href = R.home }: { href?: string }) {
	return (
		<Link href={href} className="bd-brand" aria-label="بردینو، صفحهٔ اصلی">
			<span className="bd-logomark" aria-hidden="true">
				ب
			</span>
			بردینو
		</Link>
	);
}

type ArtName = "hero" | "rewards" | "empty" | "hafez" | "tarot" | "discover" | "wallet" | "personalize";

/** One of the design's transparent illustrations (decorative: the real title and text are in HTML). */
export function Art({ name, kind, eager = false }: { name: ArtName; kind?: string; eager?: boolean }) {
	return (
		<div className={`bi-illustration bi-${kind ?? name}`} aria-hidden="true">
			<img
				src={`/bd/art/${name}-400.webp`}
				srcSet={`/bd/art/${name}-400.webp 400w, /bd/art/${name}-840.webp 840w`}
				sizes="(max-width: 540px) 70vw, 420px"
				alt=""
				width={1254}
				height={1254}
				decoding="async"
				loading={eager ? "eager" : "lazy"}
			/>
		</div>
	);
}

/** The signed-in player's points balance (main points account), or null while unknown. */
export function usePoints() {
	const { data, isLoading, error, refetch } = useGetPointsSummary();
	const account = data?.result?.token_wallet_accounts?.[0];
	return {
		// Loaded with no points account yet is a real zero; not loaded (or failed) is unknown.
		points: data?.result ? Number(account?.total_points ?? 0) : null,
		account,
		isLoading,
		error,
		refetch,
	};
}

export function Balance() {
	const { points, error } = usePoints();
	return (
		<div className="bd-balance" aria-live="polite">
			<Icon name="coins" />
			<span>{points === null ? (error ? "امتیاز نامشخص" : "…") : `${fa(points)} امتیاز`}</span>
		</div>
	);
}

function Avatar() {
	const { user } = useUserStore();
	return (
		<Link href={R.profile} className="bd-avatar" aria-label="پروفایل">
			{user?.image_url ? <img src={user.image_url} alt="" className="bd-avatar-img" /> : <Icon name="user-round" />}
		</Link>
	);
}

/** Sends a guest to the phone page; renders nothing until the session is known to exist. */
export function useRequireLogin(allowGuest = false) {
	const { isLoggedIn } = useAuthStore();
	const { replace } = useRouter();
	useEffect(() => {
		if (!isLoggedIn && !allowGuest) replace(R.login);
	}, [isLoggedIn, allowGuest, replace]);
	return isLoggedIn;
}

/** A place's QR scanned before signing in: once signed in, its page opens (and pays). */
function usePendingQr() {
	const { push } = useRouter();
	useEffect(() => {
		const token = takePendingQr();
		if (token) push(R.earnQr(token));
	}, [push]);
}

/** Keeps the stored user (name, avatar, onboarding step) in step with the server's profile. */
export function useProfileSync() {
	const { data, error, isLoading, refetch } = useGetCustomerProfile();
	const { setUser } = useUserStore();
	// A device whose notifications belong to an earlier account on it stops showing them.
	useEffect(() => {
		void reconcilePushOwner();
	}, []);
	useEffect(() => {
		const p = data?.result;
		if (!p) return;
		setUser({
			id: p.id,
			username: p.username ?? "",
			gender: p.gender,
			birthdate: p.birthdate ?? "",
			phoneNumber: p.phone_number ?? "",
			image_url: p.image_url ?? "",
			registrationStep: p.registration_step ?? "",
		});
	}, [data?.result, setUser]);
	return { profile: data?.result, error, isLoading, refetch };
}

interface ShellProps {
	nav: NavKey;
	title: string;
	/** Replaces the breadcrumb heading (the home dashboard has its own). */
	heading?: ReactNode;
	headingExtra?: ReactNode;
	/** Readable without an account (the rules): a guest gets the page without the app's navigation. */
	allowGuest?: boolean;
	children: ReactNode;
}

/** The signed-in app: brand header, main navigation (sidebar, a row on phones) and the page. */
export function AppShell({ nav, title, heading, headingExtra, allowGuest = false, children }: Readonly<ShellProps>) {
	const st = styleClass(useBdStyle());
	const loggedIn = useRequireLogin(allowGuest);
	const { user } = useUserStore();
	useEffect(() => {
		document.title = `${title} | بردینو`;
	}, [title]);
	if (!loggedIn) {
		if (!allowGuest) return null;
		return (
			<article className={`bd-product bd-app rt-product ${st} lay-1 bd-page`} aria-label={title}>
				<header className="bd-app-top">
					<Brand href={R.landing} />
					<Link href={R.login} className="bd-action">
						ورود به بردینو
					</Link>
				</header>
				<div className="rt-auth-shell">
					<main className="bd-dash rt-content" id="main">
						<div className="rt-page-heading">
							<div>
								<p className="bd-muted">بردینو / {title}</p>
								<h2>{title}</h2>
							</div>
						</div>
						<div className="rt-page-body">{children}</div>
					</main>
				</div>
			</article>
		);
	}
	return <SignedInShell nav={nav} title={title} heading={heading} headingExtra={headingExtra} username={user?.username}>{children}</SignedInShell>;
}

function SignedInShell({
	nav,
	title,
	heading,
	headingExtra,
	username,
	children,
}: Omit<ShellProps, "allowGuest"> & { username?: string }) {
	const st = styleClass(useBdStyle());
	useProfileSync();
	usePendingQr();
	return (
		<article className={`bd-product bd-app rt-product ${st} lay-1 bd-page`} aria-label={title}>
			<header className="bd-app-top">
				<Brand />
				<div className="bd-user">
					<Link href={R.wheel} className="bd-avatar bd-wheel-link" aria-label="گردونهٔ شانس">
						<img src="/media/App/wheel-icon.svg" alt="" width={22} height={22} />
					</Link>
					{username ? <span>سلام، {username}</span> : null}
					<Avatar />
				</div>
			</header>
			<div className="bd-shell">
				<nav className="bd-sidebar" aria-label="ناوبری اصلی">
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
				<main className="bd-dash rt-content" id="main">
					{heading ?? (
						<div className="rt-page-heading">
							<div>
								<p className="bd-muted">بردینو / {title}</p>
								<h2>{title}</h2>
							</div>
							{headingExtra}
						</div>
					)}
					<div className="rt-page-body">{children}</div>
				</main>
			</div>
		</article>
	);
}

/** Phone, code, profile and onboarding: brand and a home link only, never a balance. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
	const st = styleClass(useBdStyle());
	useEffect(() => {
		document.title = `${title} | بردینو`;
	}, [title]);
	return (
		<article className={`bd-product bd-app rt-product ${st} lay-1 au-product bd-page`} aria-label={title}>
			<header className="bd-app-top">
				<Brand href={R.landing} />
				<Link href={R.landing} className="bd-secondary">
					خانه
				</Link>
			</header>
			<div className="rt-auth-shell">
				<main className="bd-dash rt-content" id="main">
					<div className="rt-page-heading">
						<div>
							<p className="bd-muted">بردینو / {title}</p>
							<h2>{title}</h2>
						</div>
					</div>
					<div className="rt-page-body">{children}</div>
				</main>
			</div>
		</article>
	);
}

/** Full-width game shell: title, info (opens in place) and exit to the games list. */
export function GameShell({
	title,
	icon = "gamepad-2",
	help,
	onExit,
	children,
}: {
	title: string;
	icon?: IconName;
	help: ReactNode;
	/** Leaving may need a confirmation (a running round): return false to stay. */
	onExit?: () => boolean;
	children: ReactNode;
}) {
	const st = styleClass(useBdStyle());
	const allowed = useRequireLogin();
	const [open, setOpen] = useState(false);
	const helpBox = useRef<HTMLElement>(null);
	useDismissOutside(open, helpBox, () => setOpen(false));
	const helpId = useId();
	const { push } = useRouter();
	useEffect(() => {
		document.title = `${title} | بردینو`;
		document.getElementById("game-title")?.focus();
	}, [title]);
	if (!allowed) return null;
	return (
		<article className={`bd-product bd-app rt-product gf-product ${st} bd-page`} aria-label={title}>
			<header className="gf-top">
				<div className="gf-title">
					<Icon name={icon} />
					<h2 id="game-title" tabIndex={-1}>
						{title}
					</h2>
				</div>
				<div className="gf-tools">
					<button
						type="button"
						className="gf-icon"
						aria-label="اطلاعات بازی"
						aria-controls={helpId}
						aria-expanded={open}
						onClick={() => setOpen((v) => !v)}
					>
						<Icon name="info" />
					</button>
					<button
						type="button"
						className="gf-icon"
						aria-label="خروج از بازی"
						onClick={() => {
							// A running round (crash) asks first, as the Android Back button does.
							if (!onExit || onExit()) confirmLeave(() => push(R.games));
						}}
					>
						<Icon name="log-out" />
					</button>
				</div>
			</header>
			<section ref={helpBox} className="gf-help" id={helpId} hidden={!open} aria-label="اطلاعات بازی">
				<h3>اطلاعات {title}</h3>
				{help}
			</section>
			<main className="gf-main" id="main">
				<div className="rt-page-body">{children}</div>
			</main>
		</article>
	);
}

export function Panel({
	title,
	className = "",
	children,
	headExtra,
}: {
	title?: ReactNode;
	className?: string;
	children: ReactNode;
	headExtra?: ReactNode;
}) {
	return (
		<section className={`bd-panel rt-panel ${className}`}>
			{title ? (
				headExtra ? (
					<div className="bd-panel-head">
						<h3>{title}</h3>
						{headExtra}
					</div>
				) : (
					<h3>{title}</h3>
				)
			) : null}
			{children}
		</section>
	);
}

export function EmptyState({
	art = "empty",
	icon,
	title,
	text,
	action,
}: {
	art?: ArtName | null;
	icon?: IconName;
	title: string;
	text?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="rt-empty">
			{icon ? <Icon name={icon} /> : art ? <Art name={art} kind={art} /> : null}
			<h3>{title}</h3>
			{text ? <p>{text}</p> : null}
			{action}
		</div>
	);
}

/** Loading skeleton, or the failure with a retry; null once there is data to show. */
export function LoadState({
	loading,
	error,
	onRetry,
	errorText = "اتصال را بررسی کن و دوباره تلاش کن.",
}: {
	loading?: boolean;
	error?: unknown;
	onRetry?: () => void;
	errorText?: string;
}) {
	if (error) {
		return (
			<div role="alert">
				<EmptyState
					icon="wifi-off"
					title="دریافت اطلاعات ممکن نشد"
					text={errorText}
					action={
						onRetry ? (
							<button type="button" className="bd-secondary" onClick={onRetry}>
								تلاش دوباره
							</button>
						) : undefined
					}
				/>
			</div>
		);
	}
	if (loading) {
		return (
			<div aria-busy="true">
				<div className="rt-skeleton">
					<span />
					<span />
					<span />
				</div>
				<small className="bd-muted">در حال دریافت اطلاعات…</small>
			</div>
		);
	}
	return null;
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "ok" | "info" }) {
	return (
		<div className={`rt-notice bd-notice-${tone}`} role={tone === "warn" ? "alert" : "status"}>
			{children}
		</div>
	);
}

export function Facts({ items }: { items: [ReactNode, ReactNode][] }) {
	return (
		<dl className="rt-facts">
			{items.map(([term, value], index) => (
				<div key={index}>
					<dt>{term}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	);
}

export function ProfileRow({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: string }) {
	return (
		<Link href={href} className="rt-profile-row">
			<span className="bd-mission-icon">
				<Icon name={icon} />
			</span>
			<span>
				<b>{title}</b>
				<small>{text}</small>
			</span>
			<Icon name="chevron-left" />
		</Link>
	);
}

export function Chips<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: [T, string][];
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<div className="ng-chips" role="group" aria-label={label}>
			{options.map(([key, text]) => (
				<button key={key} type="button" className="ng-chip" aria-pressed={value === key} onClick={() => onChange(key)}>
					{text}
				</button>
			))}
		</div>
	);
}

/** Highlights the nav entry for routes whose shell does not say it (used by the 404 page). */
export function useNavFromPath(): NavKey {
	const path = usePathname();
	if (path.startsWith(R.wallet) || path.startsWith(R.lotteries)) return "wallet";
	if (path.startsWith(R.profile) || path.startsWith(R.rules)) return "profile";
	if (path.startsWith(R.games)) return "games";
	if (path.startsWith(R.earn)) return "earn";
	return "home";
}

/** Copies `text` (the Clipboard API on https, the old select-and-copy way elsewhere) and says so. */
export function CopyButton({ text, label }: { text: string; label: string }) {
	const [state, setState] = useState<"idle" | "done" | "failed">("idle");
	const copy = async () => {
		let ok = false;
		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				ok = true;
			}
		} catch {
			ok = false;
		}
		if (!ok) {
			const area = document.createElement("textarea");
			area.value = text;
			area.setAttribute("readonly", "");
			area.style.position = "fixed";
			area.style.opacity = "0";
			document.body.appendChild(area);
			area.select();
			try {
				ok = document.execCommand("copy");
			} catch {
				ok = false;
			}
			area.remove();
		}
		setState(ok ? "done" : "failed");
		window.setTimeout(() => setState("idle"), 2000);
	};
	return (
		<button type="button" className="bd-copy" onClick={copy} aria-label={label} title={label}>
			<Icon name={state === "done" ? "check" : "copy"} />
			<span aria-live="polite">{state === "done" ? "کپی شد" : state === "failed" ? "کپی نشد" : ""}</span>
		</button>
	);
}
