import React from "react";

import type { Metadata, Viewport } from "next";

import QueryProvider from "@libs/http/Provider";

import { LOGO_ADDRESS } from "@/constants/imagePaths";
import Layout from "@/libs/components/layouts/Layout";
import RegisterServiceWorker from "@/libs/components/pwa/RegisterServiceWorker";

import "./globals.css";

export const metadata: Metadata = {
	title: "بوردینو",
	icons: [
		{ rel: "icon", url: LOGO_ADDRESS },
		{ rel: "apple-touch-icon", url: "/media/icons/icon-192.png" },
	],
};

export const viewport: Viewport = {
	themeColor: "#e64056",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="fa">
			<body dir="rtl">
				<RegisterServiceWorker />
				<QueryProvider>
					<Layout>{children}</Layout>
				</QueryProvider>
			</body>
		</html>
	);
}
