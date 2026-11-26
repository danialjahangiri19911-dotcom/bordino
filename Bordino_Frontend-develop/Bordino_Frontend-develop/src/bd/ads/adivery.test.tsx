import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import AdiveryAd from "./AdiveryAd";
import { sdkHint, untilConfirmed } from "./api";
import { markSdkUser } from "./native";
import { trace } from "../trace";

jest.mock("../trace", () => ({ trace: jest.fn() }));
import { AxiosError, type AxiosResponse } from "axios";

jest.mock("../back", () => ({ useBackHandler: () => undefined }));

const pending = () =>
	new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, { status: 409, data: { errors: { code: "pending" } } } as AxiosResponse);

describe("untilConfirmed", () => {
	it("asks again while the server waits for Adivery, then returns", async () => {
		const ask = jest.fn().mockRejectedValueOnce(pending()).mockRejectedValueOnce(pending()).mockResolvedValue("paid");
		await expect(untilConfirmed(ask, 5, 1)).resolves.toBe("paid");
		expect(ask).toHaveBeenCalledTimes(3);
	});
	it("stops at once on any other refusal", async () => {
		const ask = jest.fn().mockRejectedValue(new Error("limit"));
		await expect(untilConfirmed(ask, 5, 1)).rejects.toThrow("limit");
		expect(ask).toHaveBeenCalledTimes(1);
	});
	it("gives up after its tries", async () => {
		const ask = jest.fn().mockRejectedValue(pending());
		await expect(untilConfirmed(ask, 3, 1)).rejects.toBeInstanceOf(AxiosError);
		expect(ask).toHaveBeenCalledTimes(3);
	});
});

describe("AdiveryAd", () => {
	let root: Root;
	let host: HTMLDivElement;
	const session = { session_id: "s-1", reward_points: 5, min_watch_seconds: 1, provider: "adivery", creative: { app_id: "app", placement_id: "pl" } };
	const plugin = (show: jest.Mock) => {
		(window as unknown as { Capacitor?: unknown }).Capacitor = { Plugins: { BordinoAds: { show, prepare: jest.fn() } } };
	};
	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		host = document.createElement("div");
		document.body.appendChild(host);
		root = createRoot(host);
	});
	afterEach(() => {
		act(() => root.unmount());
		host.remove();
		delete (window as unknown as { Capacitor?: unknown }).Capacitor;
	});

	it("shows the ad with the session as Adivery's user id; a full view asks the server", async () => {
		const show = jest.fn().mockResolvedValue({ rewarded: true });
		plugin(show);
		const onWatched = jest.fn();
		const onAbort = jest.fn();
		await act(async () => root.render(<AdiveryAd session={session} onWatched={onWatched} onAbort={onAbort} />));
		expect(show).toHaveBeenCalledWith({ appId: "app", placementId: "pl", userId: "s-1" });
		expect(onWatched).toHaveBeenCalledTimes(1);
		expect(onAbort).not.toHaveBeenCalled();
	});

	it("a closed-early view asks nothing and says why", async () => {
		plugin(jest.fn().mockResolvedValue({ rewarded: false }));
		const onWatched = jest.fn();
		const onAbort = jest.fn();
		await act(async () => root.render(<AdiveryAd session={session} onWatched={onWatched} onAbort={onAbort} />));
		expect(onWatched).not.toHaveBeenCalled();
		// Said, not dropped: the player closes the note.
		expect(onAbort).not.toHaveBeenCalled();
		expect(host.textContent).toContain("سکه‌ای اضافه نشد");
		await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "باشه")?.click());
		expect(onAbort).toHaveBeenCalledTimes(1);
		const steps = (trace as jest.Mock).mock.calls.filter((c) => c[1] === "s-1").map((c) => c[2]);
		expect(steps).toEqual(expect.arrayContaining(["show_asked", "closed_not_rewarded"]));
	});

	it("no ad to show: says so", async () => {
		plugin(jest.fn().mockRejectedValue({ code: "no_fill" }));
		await act(async () => root.render(<AdiveryAd session={session} onWatched={jest.fn()} onAbort={jest.fn()} />));
		expect(host.textContent).toContain("فعلاً ویدیویی برای نمایش نیست");
	});

	it("a result after the player left changes nothing", async () => {
		let resolve: (v: { rewarded: boolean }) => void = () => undefined;
		plugin(jest.fn(() => new Promise((done) => (resolve = done))));
		const onWatched = jest.fn();
		const onAbort = jest.fn();
		await act(async () => root.render(<AdiveryAd session={session} onWatched={onWatched} onAbort={onAbort} />));
		act(() => root.unmount());
		await act(async () => resolve({ rewarded: false }));
		expect(onAbort).not.toHaveBeenCalled();
		expect(onWatched).not.toHaveBeenCalled();
		root = createRoot(host); // for afterEach
	});

	it("gives Adivery the player's reference when there is one, and then lets the next ad load ahead", async () => {
		const show = jest.fn().mockResolvedValue({ rewarded: true });
		plugin(show);
		const withRef = { ...session, creative: { ...session.creative, user_ref: "abc-123" } };
		const { sdkHoldsUser } = await import("./native");
		sessionStorage.clear();
		expect(sdkHoldsUser("abc-123")).toBe(false);
		await act(async () => root.render(<AdiveryAd session={withRef} onWatched={jest.fn()} onAbort={jest.fn()} />));
		expect(show).toHaveBeenCalledWith({ appId: "app", placementId: "pl", userId: "abc-123" });
		expect(sdkHoldsUser("abc-123")).toBe(true);
		expect(sdkHoldsUser("someone-else")).toBe(false);
		expect(sdkHoldsUser(undefined)).toBe(false);
	});

	it("outside the app: says where it plays", async () => {
		await act(async () => root.render(<AdiveryAd session={session} onWatched={jest.fn()} onAbort={jest.fn()} />));
		expect(host.textContent).toContain("فقط در اپ اندروید");
	});
});

describe("sdkHint", () => {
	it("tells the server which player the phone's SDK holds (an account switch on one phone)", () => {
		sessionStorage.clear();
		expect(sdkHint()).toEqual({});
		markSdkUser("aaaa-1111");
		expect(sdkHint()).toEqual({ sdk_ref: "aaaa-1111" });
	});
});
