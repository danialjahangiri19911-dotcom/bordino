import { withSessionLock } from "./query";
import requester from "./requester";
import useAuthStore from "@libs/stores/authStore";

import { AUTH_URLS } from "@/api/urls";
import { disableOnThisDevice } from "@/bd/push";
import useUserStore from "@/libs/stores/userStore";

/**
 * Log out: end the session on the server (its refresh token is blacklisted and its access token
 * revoked, so a copied token stops working too), then forget it on this device. Offline or not,
 * the device is cleared; the server call waits at most a few seconds.
 */
export default async function signOut() {
	// This device stops receiving this account's notifications (the next player on it must not see
	// them): the server forgets the device, and the browser drops the subscription even offline.
	// Before the session lock (it may need a token) and never longer than a few seconds.
	await Promise.race([disableOnThisDevice().catch(() => undefined), new Promise((r) => setTimeout(r, 4000))]);
	// Under the session lock: a refresh in progress (in any tab) finishes first, so the tokens
	// ended here are the newest ones, not a pair that refresh is about to replace. The wait for the
	// lock is bounded too: past it the device is cleared anyway (a refresh answering later sees
	// the session gone and ends its new pair on the server instead of restoring it).
	const endOnServer = async () => {
		const { accessToken, refreshToken } = useAuthStore.getState();
		if (!refreshToken) return;
		try {
			await requester.post(
				AUTH_URLS.LOGOUT,
				{ refresh: refreshToken },
				{
					headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
					timeout: 5000,
				},
			);
		} catch {
			// The tokens are forgotten below either way.
		}
	};
	const clear = () => {
		useUserStore.getState().clearUser();
		useAuthStore.getState().logout();
	};
	let done = false;
	const locked = withSessionLock(async () => {
		if (done) return;
		await useAuthStore.persist.rehydrate();
		await endOnServer();
		done = true;
		clear();
	});
	await Promise.race([locked, new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS))]);
	if (!done) {
		done = true;
		await endOnServer();
		clear();
	}
}

/** How long logout waits for a refresh in progress before clearing the device anyway. */
const LOCK_WAIT_MS = 8000;
