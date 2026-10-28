/**
 * This device's side of «مدیریت اعلان‌ها»: browser permission + Web Push subscription, sent to the
 * server (apps/notifications), which then delivers what the switches allow.
 */
import { call } from "@/api/games/request";

export interface NotificationPrefs {
	lottery: boolean;
	account: boolean;
	games: boolean;
	push_available: boolean;
	vapid_public_key: string | null;
	devices: number;
}

export const PREFS_URL = "notifications/preferences/";

/** What this device can do about notifications. */
export type DeviceSupport = "ok" | "android-app" | "ios-install" | "unsupported";

export function deviceSupport(): DeviceSupport {
	if (typeof window === "undefined") return "unsupported";
	// The Android app's WebView has no Web Push (Bordino_Mobile would need a native push service).
	if (/BordinoApp\//.test(navigator.userAgent)) return "android-app";
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
	return "granted";
}

export async function disableOnThisDevice() {
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
