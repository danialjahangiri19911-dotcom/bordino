/**
 * This device's side of «مدیریت اعلان‌ها»: browser permission + Web Push subscription, sent to the
 * server (apps/notifications), which then delivers what the switches allow.
 */
import { call } from "@/api/games/request";
import { currentUserId } from "@/libs/stores/authStore";

/** The account that turned notifications on in this browser / app (its device is theirs). */
const OWNER_KEY = "bd-push-owner";
function setOwner(owner: string | null) {
	try {
		if (owner) localStorage.setItem(OWNER_KEY, owner);
		else localStorage.removeItem(OWNER_KEY);
	} catch {
		// private mode: the logout paths still tear the device down
	}
}

export interface NotificationPrefs {
	lottery: boolean;
	account: boolean;
	games: boolean;
	push_available: boolean;
	vapid_public_key: string | null;
	devices: number;
	/** The Android app (Pushe): can the server send, and which of the player's phones are on. */
	app_push_available?: boolean;
	app_device_ids?: string[];
}

/** The Android app's native side (Bordino_Mobile BordinoPushPlugin, Pushe). */
interface AppPushPlugin {
	status(): Promise<{ available: boolean; registered: boolean; deviceId: string | null; permission: "granted" | "denied" | "prompt" }>;
	enable(): Promise<{ deviceId: string }>;
	disable(): Promise<{ deviceId: string | null }>;
}

export function appPush(): AppPushPlugin | null {
	if (typeof window === "undefined") return null;
	const plugin = (window as unknown as { Capacitor?: { Plugins?: { BordinoPush?: AppPushPlugin } } }).Capacitor?.Plugins?.BordinoPush;
	return plugin && typeof plugin.enable === "function" ? plugin : null;
}

export const PREFS_URL = "notifications/preferences/";

/** What this device can do about notifications ("app": the Android app with Pushe; "android-app": an
 * older app version without it). */
export type DeviceSupport = "ok" | "app" | "android-app" | "ios-install" | "unsupported";

export function deviceSupport(): DeviceSupport {
	if (typeof window === "undefined") return "unsupported";
	// The Android app's WebView has no Web Push: from app 1.2 on, Pushe does it natively.
	if (/BordinoApp\//.test(navigator.userAgent)) return appPush() ? "app" : "android-app";
	const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
	const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
	// iPhone allows Web Push only to a site added to the home screen (iOS 16.4+).
	if (ios && !standalone) return "ios-install";
	if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
	return "ok";
}

export function permission(): NotificationPermission | "unsupported" {
	return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function keyBytes(base64url: string) {
	const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
	const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
	const existing = await navigator.serviceWorker.getRegistration("/pwa/");
	if (existing) return existing;
	await navigator.serviceWorker.register("/sw.js", { scope: "/pwa" });
	return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (deviceSupport() !== "ok") return null;
	const reg = await navigator.serviceWorker.getRegistration("/pwa/");
	return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks for permission (call it straight from a tap) and registers this device with the server.
 * Returns the browser's answer; "granted" means the device is registered.
 */
export async function enableOnThisDevice(vapidKey: string): Promise<NotificationPermission> {
	const answer = await Notification.requestPermission();
	if (answer !== "granted") return answer;
	const reg = await registration();
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
	await call("post", "notifications/push-subscriptions/", sub.toJSON());
	setOwner(currentUserId());
	return "granted";
}

/** The Android app: permission + Pushe registration, then the server learns this phone. */
export async function enableAppPush(): Promise<string> {
	const plugin = appPush();
	if (!plugin) throw new Error("no app push");
	const { deviceId } = await plugin.enable();
	try {
		await call("post", "notifications/app-devices/", { provider: "pushe", device_id: deviceId });
	} catch (e) {
		// The server may still have this phone under an earlier account: until it is registered to
		// this one, the phone must not show anything (it would be that account's notifications).
		await plugin.disable().catch(() => undefined);
		throw e;
	}
	setOwner(currentUserId());
	return deviceId;
}

/** The Android app stops showing notifications here; the server forgets the phone. */
export async function disableAppPush() {
	const plugin = appPush();
	if (!plugin) return;
	// The phone first (shows nothing more, whatever the network does), then the server.
	const { deviceId } = await plugin.disable().catch(() => ({ deviceId: null as string | null }));
	if (deviceId) await call("post", "notifications/app-devices/remove/", { provider: "pushe", device_id: deviceId }).catch(() => undefined);
}

export async function disableOnThisDevice() {
	setOwner(null);
	if (appPush()) return disableAppPush();
	const sub = await currentSubscription();
	if (!sub) return;
	const { endpoint } = sub;
	// The browser first: once unsubscribed, nothing for this account can show here, whatever the
	// network does. Then the server forgets the device (a dead endpoint would be dropped anyway).
	await sub.unsubscribe().catch(() => undefined);
	await call("post", "notifications/push-subscriptions/remove/", { endpoint }).catch(() => undefined);
}

export const savePrefs = (change: Partial<Pick<NotificationPrefs, "lottery" | "account" | "games">>) =>
	call<NotificationPrefs>("patch", PREFS_URL, change);

export const sendTest = () => call<{ delivered: number }>("post", "notifications/test/", {});

/**
 * This device stops showing notifications, without asking the server (for a session that has
 * already ended, e.g. a refresh the server refused: the server drops a dead browser endpoint at
 * its next send, and a phone re-registers under whoever turns notifications on next).
 */
export async function forgetOnThisDevice() {
	setOwner(null);
	try {
		const plugin = appPush();
		if (plugin) await plugin.disable();
		else await (await currentSubscription())?.unsubscribe();
	} catch {
		// nothing more can be done here
	}
}

/**
 * Another account signed in on a device where an earlier one had notifications on (whatever ended
 * that session): this device stops showing the earlier account's notifications.
 */
export async function reconcilePushOwner() {
	let owner: string | null = null;
	try {
		owner = localStorage.getItem(OWNER_KEY);
	} catch {
		return;
	}
	const me = currentUserId();
	if (owner && me && owner !== me) await forgetOnThisDevice();
}
