import { isUncertain, requestIdFor, settleRequestId, withRequestId } from "./requestId";

describe("money-action request ids (Codex audit phase 4)", () => {
	beforeEach(() => localStorage.clear());

	it("a reload after a lost answer sends the same id again", async () => {
		const sent: string[] = [];
		await expect(withRequestId("charge:sudoku", async (id) => { sent.push(id); throw new Error("network"); })).rejects.toThrow();
		jest.resetModules(); // «reload»: a fresh module, only localStorage is left
		const again = (await import("./requestId")) as typeof import("./requestId");
		await again.withRequestId("charge:sudoku", async (id) => { sent.push(id); return "ok"; });
		expect(sent[1]).toBe(sent[0]);
		// Answered: the next action is a new one.
		expect(again.requestIdFor("charge:sudoku")).not.toBe(sent[0]);
	});

	it("a clear refusal ends the id; an unknown outcome keeps it", async () => {
		const refused = { response: { status: 400 } };
		let first = "";
		await expect(withRequestId("spin:w", async (id) => { first = id; throw refused; })).rejects.toBe(refused);
		expect(requestIdFor("spin:w")).not.toBe(first);
		expect(isUncertain({ response: { status: 502 } })).toBe(true);
		expect(isUncertain({ response: { status: 409 } })).toBe(true);
		expect(isUncertain(refused)).toBe(false);
	});

	it("an old unanswered action expires", () => {
		const id = requestIdFor("withdraw");
		const stored = JSON.parse(localStorage.getItem("bd-pending-requests") ?? "{}");
		stored.withdraw.at -= 16 * 60 * 1000;
		localStorage.setItem("bd-pending-requests", JSON.stringify(stored));
		expect(requestIdFor("withdraw")).not.toBe(id);
		settleRequestId("withdraw");
		expect(localStorage.getItem("bd-pending-requests")).toBe("{}");
	});
});
