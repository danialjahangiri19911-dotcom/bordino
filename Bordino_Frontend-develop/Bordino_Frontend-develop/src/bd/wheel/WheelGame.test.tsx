/**
 * The wheel's life cycle with the server and the screen: what it lands on, what it says, what it
 * plays. The hooks are stand-ins (a controllable spin answer, frames stepped by hand).
 */
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { type Slice, sliceAt, slicesFor } from "../wheelMath";
import WheelGame from "./WheelGame";

import type { WheelPrize } from "@/api/lottery/types/getWheelType";

const prize = (id: number, amount: number, probability: number, type: WheelPrize["prize_type"] = "recharge") =>
	({ id, name: String(amount), prize_amount: String(amount), prize_type: type, probability }) as unknown as WheelPrize;

let prizes: WheelPrize[] = [];
let answer: (value: unknown) => void = () => undefined;
const spinAsync = jest.fn((_payload?: unknown) => new Promise((done) => (answer = done)));
const effects: string[] = [];

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("../appearance", () => ({ useResolvedScheme: () => "light" }));
jest.mock("../autoHide", () => ({ GameBar: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../back", () => ({ useBackHandler: () => undefined }));
jest.mock("../ui", () => ({
	R: { home: "/pwa/main" },
	useRequireLogin: () => true,
	usePoints: () => ({ points: 1000, account: { id: "acc" }, refetch: jest.fn() }),
}));
let cost = "10";
jest.mock("@/api/lottery/hooks/useGetWheel", () => () => ({
	data: { result: { name: "گردونه", cost_per_spin: cost, min_bet: 10, max_bet: 500, lottery_wheel_prizes: prizes } },
	isLoading: false,
	error: null,
	refetch: jest.fn(),
}));
jest.mock("@/api/lottery/hooks/useSpinWheel", () => () => ({ spinAsync }));
jest.mock("./soundtrack", () => ({
	createSoundtrack: () => ({ start: jest.fn(), stop: jest.fn(), destroy: jest.fn(), effect: (k: string) => effects.push(k) }),
}));

// Animation frames stepped by hand.
let frames: FrameRequestCallback[] = [];
let clock = 0;
const step = (ms: number) => {
	clock += ms;
	const due = frames;
	frames = [];
	due.forEach((f) => f(clock));
};
const runSpin = () => {
	for (let i = 0; i < 200 && frames.length; i++) act(() => step(50));
};

let root: Root;
let host: HTMLDivElement;
const render = () => act(() => root.render(<WheelGame />));
const q = <T extends Element = HTMLElement>(sel: string) => host.querySelector(sel) as T;
const rotation = () => parseFloat(q(".wh-rotor").style.transform.replace(/[^0-9.-]/g, ""));
const click = async (sel: string) => {
	await act(async () => q<HTMLButtonElement>(sel).click());
};
const reply = async (result: unknown) => {
	await act(async () => answer({ result }));
};

let reduce = false;
beforeEach(() => {
	prizes = [prize(1, 0, 50, "empty"), prize(2, 20, 50)];
	effects.length = 0;
	frames = [];
	clock = 0;
	reduce = false;
	spinAsync.mockClear();
	cost = "10";
	window.requestAnimationFrame = (f) => (frames.push(f), frames.length);
	window.cancelAnimationFrame = () => {
		frames = [];
	};
	window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") && reduce, media: query })) as unknown as typeof window.matchMedia;
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

const under = (slices: Slice[]) => slices[sliceAt(slices, rotation())].prize.id;

describe("WheelGame", () => {
	it("lands on the server's prize even when the wheel is refetched with new odds mid-spin", async () => {
		render();
		const before = slicesFor(prizes, 1);
		await click(".wh-spin");
		await reply({ prize: { ...prizes[1], prize_amount: "20" } });
		prizes = [prize(1, 0, 99, "empty"), prize(2, 20, 1)]; // a refetch: other odds
		render();
		runSpin();
		expect(under(before)).toBe(2);
		expect(q(".wh-selected text")?.textContent).toBe("۲۰");
		expect(q(".wh-result strong").textContent).toBe("۲۰ امتیاز");
	});

	it("shows the server's amount and type, also for a prize this page does not know", async () => {
		render();
		await click(".wh-spin");
		await reply({ prize: prize(9, 500000, 1, "cash") });
		runSpin();
		expect(q(".wh-result strong").textContent).toBe("۵۰۰٬۰۰۰ تومان");
		expect(q(".wh-history .wh-chip").textContent).toBe("۵۰۰٬۰۰۰ ت");
	});

	it("a prize drawn with no room (0% when the spin began) is shown, never landed beside", async () => {
		prizes = [prize(1, 0, 100, "empty"), prize(2, 20, 0)];
		render();
		await click(".wh-spin");
		await reply({ prize: prizes[1] });
		runSpin();
		expect(q(".wh-result strong").textContent).toBe("۲۰ امتیاز");
		expect(q(".wh-selected")).toBeNull();
	});

	it("history repeats what the server paid, not the cached prize", async () => {
		render();
		await click(".wh-spin");
		await reply({ prize: { ...prizes[1], prize_amount: "40" } });
		runSpin();
		expect(q(".wh-result strong").textContent).toBe("۴۰ امتیاز");
		expect(q(".wh-history .wh-chip").textContent).toBe("۴۰");
	});

	it("a mute during the spin silences the rest of it", async () => {
		render();
		await click(".wh-spin");
		await reply({ prize: prizes[1] });
		act(() => step(400));
		await click('[aria-pressed="true"]'); // the sound switch
		const before = effects.length;
		runSpin();
		expect(effects.length).toBe(before);
	});

	it("with reduced motion the wheel holds still, then shows where it stopped", async () => {
		reduce = true;
		render();
		await click(".wh-spin");
		await reply({ prize: prizes[1] });
		const seen = new Set<number>();
		for (let i = 0; i < 40 && frames.length; i++) {
			act(() => step(50));
			seen.add(Math.round(rotation()));
		}
		expect(seen.size).toBeLessThanOrEqual(2);
		expect(under(slicesFor(prizes, 1))).toBe(2);
	});

	it("leaving before the answer starts nothing afterwards", async () => {
		render();
		await click(".wh-spin");
		act(() => root.unmount());
		await act(async () => answer({ result: { prize: prizes[1] } }));
		expect(frames.length).toBe(0);
		root = createRoot(host); // for afterEach
	});

	it("sends the chosen bet", async () => {
		render();
		await click('[aria-label="زیاد کردن شرط"]');
		await click(".wh-spin");
		expect(spinAsync).toHaveBeenCalledWith(expect.objectContaining({ bet: 20 }));
	});

	it("a free wheel takes no bet and sends none", async () => {
		cost = "0";
		render();
		expect(q(".wh-cost").hidden).toBe(true);
		await click(".wh-spin");
		expect(spinAsync).toHaveBeenCalledTimes(1);
		expect(spinAsync.mock.calls[0][0]).not.toHaveProperty("bet");
	});

	it("one click, one spin", async () => {
		render();
		await act(async () => {
			q<HTMLButtonElement>(".wh-spin").click();
			q<HTMLButtonElement>(".wh-spin").click();
		});
		expect(spinAsync).toHaveBeenCalledTimes(1);
	});
});
