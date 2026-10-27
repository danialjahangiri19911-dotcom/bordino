import React from "react";

import type { Metadata, Viewport } from "next";

import QueryProvider from "@libs/http/Provider";

import { APPEARANCE_SCRIPT } from "@/bd/appearance";
// The design's stylesheet first; app.css (production frame and additions) overrides it.
import "@/bd/bd.css";
import "@/bd/app.css";
import { LOGO_ADDRESS } from "@/constants/imagePaths";
import Layout from "@/libs/components/layouts/Layout";

import "./globals.css";

export const metadata: Metadata = {
	title: "بوردینو",
	icons: LOGO_ADDRESS,
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
			</head>
			<body dir="rtl">
				<QueryProvider>
					<Layout>{children}</Layout>
				</QueryProvider>
			</body>
		</html>
	);
}
