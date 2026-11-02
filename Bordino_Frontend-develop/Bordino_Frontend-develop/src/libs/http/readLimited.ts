/**
 * The body as text, read as it arrives and abandoned as soon as it passes `limit` bytes (null): a
 * huge or endless body is never held in memory whole.
 */
export async function readLimited(request: Request, limit: number): Promise<string | null> {
	const declared = Number(request.headers.get("content-length") ?? "");
	if (declared > limit || !request.body) return null;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		chunks.push(value);
	}
	const all = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		all.set(c, at);
		at += c.byteLength;
	}
	return new TextDecoder().decode(all);
}
