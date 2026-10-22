import { withSessionLock } from "./query";
import requester from "./requester";
import useAuthStore from "@libs/stores/authStore";

import { AUTH_URLS } from "@/api/urls";
import useUserStore from "@/libs/stores/userStore";

/**
 * Log out: end the session on the server (its refresh token is blacklisted and its access token
 * revoked, so a copied token stops working too), then forget it on this device. Offline or not,
 * the device is cleared; the server call waits at most a few seconds.
 */
export default async function signOut() {
	// Under the session lock: a refresh in progress (in any tab) finishes first, so the tokens
	// ended here are the newest ones, not a pair that refresh is about to replace.
	await withSessionLock(async () => {
		await useAuthStore.persist.rehydrate();
		const { accessToken, refreshToken } = useAuthStore.getState();
		if (refreshToken) {
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
		}
		useUserStore.getState().clearUser();
		useAuthStore.getState().logout();
	});
}
