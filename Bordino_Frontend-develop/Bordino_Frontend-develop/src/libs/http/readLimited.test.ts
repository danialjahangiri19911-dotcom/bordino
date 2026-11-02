/** @jest-environment node */
import { readLimited } from "./readLimited";

const streamOf = (chunks: string[], onCancel: () => void) =>
	new ReadableStream<Uint8Array>({
		pull(controller) {
			const next = chunks.shift();
			if (next === undefined) controller.close();
			else controller.enqueue(new TextEncoder().encode(next));
		},
		cancel: onCancel,
	});

const post = (body: ReadableStream<Uint8Array> | string, headers: Record<string, string> = {}) =>
	new Request("http://x/monitoring", { method: "POST", body, headers, duplex: "half" } as RequestInit);

describe("readLimited", () => {
	it("returns the text of a body within the limit, multibyte included", async () => {
		expect(await readLimited(post("سلام"), 8)).toBe("سلام"); // 8 bytes
	});

	it("stops reading, and cancels, as soon as the bytes pass the limit", async () => {
		let cancelled = false;
		const chunks = ["aaaa", "bbbb", "cccc", "dddd"];
		expect(await readLimited(post(streamOf(chunks, () => (cancelled = true))), 6)).toBeNull();
		expect(cancelled).toBe(true);
		expect(chunks.length).toBeGreaterThanOrEqual(1); // never read to the end
	});

	it("counts bytes, not characters", async () => {
		expect(await readLimited(post("سلام"), 7)).toBeNull();
	});

	it("refuses a declared length over the limit without reading", async () => {
		expect(await readLimited(post("abc", { "content-length": "999999" }), 10)).toBeNull();
	});
});
