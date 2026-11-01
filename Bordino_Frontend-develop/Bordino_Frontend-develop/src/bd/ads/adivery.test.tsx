import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import AdiveryAd from "./AdiveryAd";
import { untilConfirmed } from "./api";
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

	it("a closed-early view asks nothing", async () => {
		plugin(jest.fn().mockResolvedValue({ rewarded: false }));
		const onWatched = jest.fn();
		const onAbort = jest.fn();
		await act(async () => root.render(<AdiveryAd session={session} onWatched={onWatched} onAbort={onAbort} />));
		expect(onWatched).not.toHaveBeenCalled();
		expect(onAbort).toHaveBeenCalledTimes(1);
	});

	it("no ad to show: says so", async () => {
		plugin(jest.fn().mockRejectedValue({ code: "no_fill" }));
		await act(async () => root.render(<AdiveryAd session={session} onWatched={jest.fn()} onAbort={jest.fn()} />));
		expect(host.textContent).toContain("فعلاً ویدیویی برای نمایش نیست");
	});

	it("outside the app: says where it plays", async () => {
		await act(async () => root.render(<AdiveryAd session={session} onWatched={jest.fn()} onAbort={jest.fn()} />));
		expect(host.textContent).toContain("فقط در اپ اندروید");
	});
});
