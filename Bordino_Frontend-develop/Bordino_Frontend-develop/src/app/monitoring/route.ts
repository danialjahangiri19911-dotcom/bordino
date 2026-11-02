import { readLimited } from "@/libs/http/readLimited";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sentry tunnel (next.config tunnelRoute "/monitoring"): the browser posts its error envelopes here
// so ad-blockers don't drop them. It forwards ONLY to the project this app is configured for — the
// envelope's own `dsn` (attacker-controlled) never chooses the destination — and answers with a fixed
// empty body, never the upstream's content.
const SENTRY_HOST = "sentry.karpelleh.com";
const SENTRY_PROJECT = "10";
const MAX_BYTES = 200_000;

export async function POST(request: Request) {
	try {
		const envelope = await readLimited(request, MAX_BYTES);
		if (envelope === null) return new Response(null, { status: 413 });
		if (!envelope) {
			return new Response(null, { status: 400 });
		}
		const header = JSON.parse(envelope.split("\n")[0]);
		const match = /^https:\/\/[^@/]+@([^/]+)\/(\d+)$/.exec(String(header?.dsn ?? ""));
		if (!match || match[1] !== SENTRY_HOST || match[2] !== SENTRY_PROJECT) {
			return new Response(null, { status: 400 });
		}
		await fetch(`https://${SENTRY_HOST}/api/${SENTRY_PROJECT}/envelope/`, {
			method: "POST",
			headers: { "Content-Type": "application/x-sentry-envelope" },
			body: envelope,
			redirect: "manual",
			signal: AbortSignal.timeout(5000),
		});
		return new Response(null, { status: 204 });
	} catch {
		return new Response(null, { status: 400 });
	}
}
