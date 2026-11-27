import React from "react";

import type { Metadata, Viewport } from "next";

import QueryProvider from "@libs/http/Provider";

import { APPEARANCE_SCRIPT } from "@/bd/appearance";
import { PALETTE_CSS } from "@/bd/palettes";
// The design's stylesheet first; app.css (production frame and additions) overrides it.
import "@/bd/bd.css";
import "@/bd/app.css";
// The neon and neumorphism styles a player can pick (neumorphism is the default since 2026-11-26).
import "@/bd/themes.css";
import Layout from "@/libs/components/layouts/Layout";

import "./globals.css";

export const metadata: Metadata = {
	title: "بردینو",
	// The player app's manifest (public/manifest.json); /ops declares its own (src/app/ops/layout.tsx).
	manifest: "/manifest.json",
	// The tab icon: the «ب» brand tile (drawn as SVG; PNG for browsers without SVG favicons).
	icons: {
		icon: [
			{ url: "/bd/icons/favicon.svg", type: "image/svg+xml" },
			{ url: "/bd/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
		],
		apple: "/bd/icons/apple-touch-icon.png",
	},
	// iPhone «Add to Home Screen» opens full-screen with the Persian name.
	appleWebApp: { capable: true, title: "بردینو", statusBarStyle: "default" },
	// iPhone Safari turns digit runs (phone numbers, amounts) into links before React starts, which
	// changes the page under it (hydration error) and makes numbers tappable «call» links.
	formatDetection: { telephone: false, date: false, email: false, address: false },
};

export const viewport: Viewport = {
	themeColor: "#fff8eb",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="fa" dir="rtl" suppressHydrationWarning>
			<head>
				{/* Applies the stored light/dark choice before the first paint (no light flash). */}
				<script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
				{/* The approved palettes (bd/palettes.ts), the one source of every theme's colours. */}
				<style id="bd-palettes" dangerouslySetInnerHTML={{ __html: PALETTE_CSS }} />
			</head>
			<body dir="rtl">
				<QueryProvider>
					<Layout>{children}</Layout>
				</QueryProvider>
			</body>
		</html>
	);
}
