/** Codex audit phase 5: ending a session clears this device in bounded time and tears down push. */
import axios from "axios";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (user: string) => `${b64({ alg: "HS256" })}.${b64({ user_id: user, exp: 9999999999 })}.s`;

jest.mock("./requester", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));
const forget = jest.fn(async () => undefined);
jest.mock("@/bd/push", () => ({ forgetOnThisDevice: () => forget(), disableOnThisDevice: async () => undefined }));

// logout() leaves the page; jsdom cannot navigate.
const replace = jest.fn();
Object.defineProperty(window, "location", { value: { ...window.location, replace, reload: jest.fn() }, writable: true });

import requester from "./requester";
import { refreshAccessToken } from "./query";
import signOut from "./signOut";
import useAuthStore from "@libs/stores/authStore";

describe("session end", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useAuthStore.setState({ isLoggedIn: true, accessToken: jwt("a"), refreshToken: jwt("a") });
	});

	it("a refused refresh stops this device's notifications before logging out", async () => {
		const order: string[] = [];
		forget.mockImplementation(async () => void order.push("forget"));
		replace.mockImplementation(() => order.push("logout"));
		jest.spyOn(axios, "post").mockRejectedValueOnce({ response: { status: 401 } });
		await expect(refreshAccessToken(jwt("a"))).rejects.toBeTruthy();
		expect(order).toEqual(["forget", "logout"]);
		expect(useAuthStore.getState().refreshToken).toBeNull();
	});

	it("a refused refresh does not log out a newer session that started meanwhile", async () => {
		let release!: () => void;
		forget.mockImplementation(() => new Promise<undefined>((r) => (release = () => r(undefined))));
		jest.spyOn(axios, "post").mockRejectedValueOnce({ response: { status: 401 } });
		const refusing = refreshAccessToken(jwt("a"));
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
		useAuthStore.setState({ isLoggedIn: true, accessToken: jwt("b"), refreshToken: jwt("b") }); // another tab
		release();
		await expect(refusing).rejects.toBeTruthy();
		expect(useAuthStore.getState().refreshToken).toBe(jwt("b"));
	});

	it("logout clears the device even while a hung refresh holds the session lock", async () => {
		jest.useFakeTimers();
		// The lock is held (a refresh that never answers): request() never runs the task.
		Object.defineProperty(navigator, "locks", { value: { request: () => new Promise(() => undefined) }, configurable: true });
		(requester.post as jest.Mock).mockResolvedValue({});
		const done = signOut();
		await jest.advanceTimersByTimeAsync(4000 + 8000 + 10);
		await done;
		expect(useAuthStore.getState().refreshToken).toBeNull();
		expect(requester.post).toHaveBeenCalled(); // still asked the server to end the session
		delete (navigator as { locks?: unknown }).locks;
		jest.useRealTimers();
	});
});
