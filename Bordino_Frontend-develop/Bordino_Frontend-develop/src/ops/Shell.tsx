"use client";

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import Icon, { type IconName } from "@/bd/Icon";
import { styleClass, useBdStyle } from "@/bd/appearance";
import { LoadState } from "@/bd/ui";

import { type OpsMe, type OpsRole, ROLE_NAME, retryRevokes, session, signOut, subscribeSession, useOps, useSessionUser } from "./client";

export const OPS = {
	home: "/ops",
	login: "/ops/login",
	games: "/ops/games",
	version: (id: string) => `/ops/games/v/${id}`,
	game: (id: string) => `/ops/games/g/${id}`,
	withdrawals: "/ops/withdrawals",
	withdrawal: (id: string) => `/ops/withdrawals/${id}`,
	banks: "/ops/bank-accounts",
	settings: "/ops/settings",
	users: "/ops/users",
	maintenance: "/ops/maintenance",
	staff: "/ops/staff",
	audit: "/ops/audit",
} as const;

export type OpsNav = "home" | "games" | "withdrawals" | "banks" | "settings" | "users" | "maintenance" | "staff" | "audit";

/** The menu: each entry shows only for the roles that can use it ("owner" = the super admin). */
const NAV: { key: OpsNav; icon: IconName; label: string; href: string; roles: (OpsRole | "owner" | "any")[] }[] = [
	{ key: "home", icon: "house", label: "داشبورد", href: OPS.home, roles: ["any"] },
	{ key: "games", icon: "shield-check", label: "بازی‌های سازندگان", href: OPS.games, roles: ["reviewer"] },
	{ key: "withdrawals", icon: "banknote", label: "درخواست‌های برداشت", href: OPS.withdrawals, roles: ["finance"] },
	{ key: "banks", icon: "landmark", label: "حساب‌های بانکی", href: OPS.banks, roles: ["finance"] },
	{ key: "settings", icon: "pencil", label: "تنظیمات", href: OPS.settings, roles: ["settings"] },
	{ key: "users", icon: "users", label: "کاربران", href: OPS.users, roles: ["any"] },
	{ key: "maintenance", icon: "monitor", label: "سلامت سرور", href: OPS.maintenance, roles: ["any"] },
	{ key: "staff", icon: "user-plus", label: "کارکنان و نقش‌ها", href: OPS.staff, roles: ["owner"] },
	{ key: "audit", icon: "history", label: "سابقهٔ کارها", href: OPS.audit, roles: ["any"] },
];

export function allowed(me: OpsMe | undefined, roles: (OpsRole | "owner" | "any")[]): boolean {
	if (!me) return false;
	if (roles.includes("any")) return true;
	if (me.owner) return true;
	return roles.some((r) => r !== "owner" && r !== "any" && me.roles.includes(r));
}

/** Signed in to the admin app? (null while the page has not read the device's storage yet.) */
export function useSignedIn(): boolean | null {
	return useSyncExternalStore(
		subscribeSession,
		() => !!session()?.access,
		() => null,
	);
}

interface InstallEvent extends Event {
	prompt: () => Promise<void>;
}

function useInstall() {
	const deferred = useRef<InstallEvent | null>(null);
	const [can, setCan] = useState(false);
	useEffect(() => {
		const onPrompt = (e: Event) => {
			e.preventDefault();
			deferred.current = e as InstallEvent;
			setCan(true);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		// The admin app's own service worker (scope /ops/): what makes it installable as its own app.
		if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
			navigator.serviceWorker.register("/ops-sw.js", { scope: "/ops/" }).catch(() => undefined);
		}
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);
	return can
		? () => {
				void deferred.current?.prompt();
				setCan(false);
			}
		: null;
}

/** «بردینو ادمین»: its own header and menu (by role), around every admin page. */
export default function OpsShell({
	nav,
	title,
	children,
	actions,
	need = ["any"],
}: {
	nav?: OpsNav;
	title: string;
	children: ReactNode;
	actions?: ReactNode;
	need?: (OpsRole | "owner" | "any")[];
}) {
	const st = styleClass(useBdStyle());
	const router = useRouter();
	const signedIn = useSignedIn();
	const meQ = useOps<{ me: OpsMe }>(signedIn ? "me/" : null);
	const me = meQ.data?.me;
	const install = useInstall();
	const queryClient = useQueryClient();
	useEffect(() => {
		document.title = `${title} | بردینو ادمین`;
	}, [title]);
	useEffect(() => {
		if (signedIn === false) router.replace(OPS.login);
	}, [signedIn, router]);
	// Another tab signed in as someone else: a full page load, so nothing the previous staff member
	// saw (lists, IBANs, settings) stays on this screen, not even until the next fetch.
	const who = useSessionUser();
	const seen = useRef<string | null>(null);
	useEffect(() => {
		if (who === null) return;
		if (seen.current && who !== seen.current) location.reload();
		else seen.current = who;
	}, [who]);
	// Sign-outs the server did not confirm earlier: sent again.
	useEffect(() => {
		void retryRevokes();
	}, []);
	if (!signedIn) return null;
	const logout = async () => {
		await signOut(() => queryClient.removeQueries({ queryKey: ["ops"] }));
		router.replace(OPS.login);
	};
	let body: ReactNode = children;
	if (!me) body = <LoadState loading={meQ.isLoading} error={meQ.error} onRetry={meQ.refetch} />;
	else if (!allowed(me, need))
		body = (
			<div className="rt-empty">
				<Icon name="lock-keyhole" />
				<h3>این بخش برای نقش تو باز نیست</h3>
				<p className="bd-muted">مدیر اصلی می‌تواند نقشش را به تو بدهد.</p>
			</div>
		);
	return (
		<article className={`bd-product bd-app rt-product ${st} lay-1 bd-page ops-product`} aria-label={title}>
			<header className="bd-app-top ops-top">
				<Link href={OPS.home} className="bd-brand">
					<span className="bd-logomark ops-logomark" aria-hidden="true">
						ب
					</span>
					بردینو ادمین
				</Link>
				<div className="ops-top-tools">
					{install ? (
						<button type="button" className="bd-secondary" onClick={install}>
							<Icon name="download" /> نصب اپ ادمین
						</button>
					) : null}
					<button type="button" className="bd-secondary ops-top-logout" aria-label="خروج" title="خروج" onClick={() => void logout()}>
						<Icon name="log-out" />
					</button>
				</div>
			</header>
			<div className="bd-shell">
				<nav id="ops-nav" className="bd-sidebar ops-nav" aria-label="ناوبری اپ ادمین">
					{NAV.filter((n) => allowed(me, n.roles)).map((item) => (
						<Link key={item.key} href={item.href} className="bd-nav-item" aria-current={item.key === nav ? "page" : undefined}>
							<Icon name={item.icon} />
							{item.label}
						</Link>
					))}
					{me ? (
						<div className="ops-who">
							<b>{me.name || me.phone}</b>
							<small className="bd-muted">{me.owner ? "مدیر اصلی (همهٔ نقش‌ها)" : me.roles.map((r) => ROLE_NAME[r]).join("، ")}</small>
							<button type="button" className="bd-text-btn" onClick={() => void logout()}>
								<Icon name="log-out" /> خروج
							</button>
						</div>
					) : null}
				</nav>
				<main className="bd-dash rt-content" id="main">
					<div className="rt-page-heading">
						<div>
							<p className="bd-muted">بردینو ادمین / {title}</p>
							<h2>{title}</h2>
						</div>
						{me && allowed(me, need) ? actions : null}
					</div>
					<div className="rt-page-body">{body}</div>
				</main>
			</div>
		</article>
	);
}
