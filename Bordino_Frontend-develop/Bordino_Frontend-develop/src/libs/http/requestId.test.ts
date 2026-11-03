import { isUncertain, pendingRequestId, requestIdFor, settleRequestId, withRequestId } from "./requestId";
import useAuthStore from "@/libs/stores/authStore";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const as = (user: string) => {
	const jwt = `${b64({ alg: "HS256" })}.${b64({ user_id: user, exp: 9999999999 })}.s`;
	useAuthStore.setState({ isLoggedIn: true, accessToken: jwt, refreshToken: jwt });
};
const lost = () => Promise.reject(new Error("network"));

describe("money-action request ids (Codex audit phase 4 + final review)", () => {
	beforeEach(() => {
		localStorage.clear();
		as("a");
	});

	it("a reload after a lost answer sends the same id again", async () => {
		const sent: string[] = [];
		await expect(withRequestId("charge:sudoku", async (id) => { sent.push(id); return lost(); })).rejects.toThrow();
		jest.resetModules(); // «reload»: a fresh module, only localStorage is left
		const again = (await import("./requestId")) as typeof import("./requestId");
		await again.withRequestId("charge:sudoku", async (id) => { sent.push(id); return "ok"; });
		expect(sent[1]).toBe(sent[0]);
		expect(again.requestIdFor("charge:sudoku")).not.toBe(sent[0]); // answered: next one is new
	});

	it("an unanswered action keeps its id however long it waits (no expiry)", async () => {
		await expect(withRequestId("withdraw", async () => lost())).rejects.toThrow();
		const id = requestIdFor("withdraw");
		jest.spyOn(Date, "now").mockReturnValue(Date.now() + 30 * 24 * 3600 * 1000);
		expect(requestIdFor("withdraw")).toBe(id);
		jest.restoreAllMocks();
	});

	it("an answer clears only its own id, not a newer one another tab is waiting on", () => {
		const x = requestIdFor("charge:sudoku");
		settleRequestId("charge:sudoku", x); // tab A: answered
		const y = requestIdFor("charge:sudoku"); // tab A: the next game, still unanswered
		settleRequestId("charge:sudoku", x); // tab B: X's late answer
		expect(requestIdFor("charge:sudoku")).toBe(y);
	});

	it("each account keeps its own pending ids", async () => {
		await expect(withRequestId("withdraw", async () => lost())).rejects.toThrow();
		const forA = requestIdFor("withdraw");
		as("b");
		await withRequestId("withdraw", async (id) => {
			expect(id).not.toBe(forA);
			return "ok";
		});
		as("a");
		expect(requestIdFor("withdraw")).toBe(forA);
	});

	it("a refusal (4xx, 409 too) ends the id; no answer or a 5xx keeps it", async () => {
		let first = "";
		await expect(withRequestId("spin:w:1", async (id) => { first = id; throw { response: { status: 409 } }; })).rejects.toBeTruthy();
		expect(requestIdFor("spin:w:1")).not.toBe(first);
		expect(isUncertain({ response: { status: 502 } })).toBe(true);
		expect(isUncertain(new Error("network"))).toBe(true);
		expect(isUncertain({ response: { status: 409 } })).toBe(false);
	});

	it("a pending id can be looked at without making one", async () => {
		expect(pendingRequestId("charge:sudoku")).toBeNull();
		expect(pendingRequestId("charge:sudoku")).toBeNull(); // looking made none
		await expect(withRequestId("charge:sudoku", async () => lost())).rejects.toThrow();
		expect(pendingRequestId("charge:sudoku")).toBe(requestIdFor("charge:sudoku"));
	});

	it("a spin at another multiplier is another action", async () => {
		await expect(withRequestId("spin:w:1", async () => lost())).rejects.toThrow();
		expect(requestIdFor("spin:w:5")).not.toBe(requestIdFor("spin:w:1"));
	});
});
