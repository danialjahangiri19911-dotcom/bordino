import React from "react";

import type { Metadata } from "next";

import QueryProvider from "@libs/http/Provider";

import { LOGO_ADDRESS } from "@/constants/imagePaths";
import Layout from "@/libs/components/layouts/Layout";

import "./globals.css";

export const metadata: Metadata = {
	title: "Bordino",
	icons: LOGO_ADDRESS,
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="fa">
			<body dir="rtl">
				<QueryProvider>
					<Layout>{children}</Layout>
				</QueryProvider>
			</body>
		</html>
	);
}
