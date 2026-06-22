export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// This route handler tunnels Sentry requests to avoid ad-blockers
// It matches the tunnelRoute configured in next.config.mjs
export async function POST(request: Request) {
	try {
		const envelope = await request.text();

		if (!envelope) {
			return new Response("Empty envelope", { status: 400 });
		}

		const pieces = envelope.split("\n");
		if (pieces.length === 0) {
			return new Response("Invalid envelope format", { status: 400 });
		}

		const header = JSON.parse(pieces[0]);

		// Extract DSN from header
		const dsn = header.dsn;
		if (!dsn) {
			return new Response("Missing DSN", { status: 400 });
		}

		// Parse DSN to get Sentry URL
		// DSN format: https://[publicKey]@[host]/[projectId]
		const dsnMatch = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
		if (!dsnMatch) {
			return new Response("Invalid DSN format", { status: 400 });
		}

		const [, , host, projectId] = dsnMatch;

		// Construct the Sentry envelope endpoint URL
		// The URL should be: https://[host]/api/[projectId]/envelope/
		const sentryUrl = `https://${host}/api/${projectId}/envelope/`;

		// Forward the envelope to Sentry with proper headers
		const response = await fetch(sentryUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-sentry-envelope",
				"User-Agent": request.headers.get("User-Agent") || "Sentry-Tunnel/1.0",
			},
			body: envelope,
		});

		// Get response body
		const responseBody = await response.text();

		// Return the response from Sentry with proper status and headers
		return new Response(responseBody || null, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				"Content-Type": response.headers.get("Content-Type") || "text/plain",
				"X-Sentry-Tunnel": "1",
			},
		});
	} catch (error) {
		// Don't use Sentry.captureException here to avoid infinite loop
		// eslint-disable-next-line no-console
		console.error("Sentry tunnel error:", error);
		return new Response(
			JSON.stringify({
				error: "Internal Server Error",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
