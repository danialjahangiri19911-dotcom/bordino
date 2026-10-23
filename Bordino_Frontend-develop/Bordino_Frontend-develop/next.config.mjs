import withPWA from "next-pwa";

import { withSentryConfig } from "@sentry/nextjs";

const pwaConfig = {
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
	scope: "/pwa",
	sw: "sw.js",
	// No precache: next-pwa lists every build file (176 files, ~18 MB on first visit, plus ~70 source
	// maps / manifests that do not exist on the server, which made the worker's install fail and
	// kept it from ever activating). Only the runtime rules below apply: fonts and images are cached
	// as they are used; pages and API answers are never cached.
	buildExcludes: [/.*/],
	publicExcludes: ["!**/*"],
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
				},
			},
		},
		{
			urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-font-assets",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
				},
			},
		},
		{
			urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-image-assets",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
	],
};

const nextConfig = {
	reactStrictMode: true,
	compiler: {
		removeConsole: process.env.NODE_ENV !== "development",
	},
	images: {
		domains: [
			"localhost",
			// TODO: Later add production image source url
			process.env.NODE_ENV === "development" ? "api.dev.bordino.co" : "",
		],
	},
};

const configWithPWA = withPWA(pwaConfig)(nextConfig);

export default withSentryConfig(configWithPWA, {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "sentry",
	project: "bordino-front",
	sentryUrl: "https://sentry.karpelleh.com/",

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	tunnelRoute: "/monitoring",

	webpack: {
		// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
		// See the following for more information:
		// https://docs.sentry.io/product/crons/
		// https://vercel.com/docs/cron-jobs
		automaticVercelMonitors: true,

		// Tree-shaking options for reducing bundle size
		treeshake: {
			// Automatically tree-shake Sentry logger statements to reduce bundle size
			removeDebugLogging: true,
		},
	},
});
