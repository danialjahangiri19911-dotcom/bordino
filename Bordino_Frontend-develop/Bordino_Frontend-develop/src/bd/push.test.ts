/** Codex audit phase 5: a device keeps no earlier account's notifications after another signs in. */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (user: string) => `${b64({ alg: "HS256" })}.${b64({ user_id: user, exp: 9999999999 })}.s`;

jest.mock("@/api/games/request", () => ({ call: jest.fn() }));

import { reconcilePushOwner } from "./push";
import useAuthStore from "@/libs/stores/authStore";

const unsubscribe = jest.fn(async () => true);
function withSubscription() {
	window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
	(window as unknown as { PushManager: unknown }).PushManager = function PushManager() {};
	(window as unknown as { Notification: unknown }).Notification = { permission: "granted" };
	Object.defineProperty(navigator, "serviceWorker", {
		value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ unsubscribe }) } }) },
		configurable: true,
	});
}

describe("push owner", () => {
	beforeEach(() => {
		localStorage.clear();
		unsubscribe.mockClear();
		withSubscription();
	});

	it("another account on this device drops the earlier one's subscription", async () => {
		localStorage.setItem("bd-push-owner", "a");
		useAuthStore.setState({ isLoggedIn: true, accessToken: jwt("b"), refreshToken: jwt("b") });
		await reconcilePushOwner();
		expect(unsubscribe).toHaveBeenCalled();
		expect(localStorage.getItem("bd-push-owner")).toBeNull();
	});

	it("the same account keeps its notifications", async () => {
		localStorage.setItem("bd-push-owner", "a");
		useAuthStore.setState({ isLoggedIn: true, accessToken: jwt("a"), refreshToken: jwt("a") });
		await reconcilePushOwner();
		expect(unsubscribe).not.toHaveBeenCalled();
	});
});
