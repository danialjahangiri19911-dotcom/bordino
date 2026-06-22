"use client";

import type { ReactNode } from "react";
import React, { memo, useCallback, useEffect, useMemo } from "react";
import { ToastContainer } from "react-toastify";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import useHydrated from "./useHydrated";
import LandingLayout from "@libs/components/layouts/LandingLayout";
import PwaLayout from "@libs/components/layouts/PwaLayout";
import showToastEmitter from "@libs/components/toasts/ToastEmitter/showToastEmitter";
import { AppRouterCacheProvider } from "@libs/http/AppRouterCacheProvider";
import { GlobalStyles } from "@libs/styles/GlobalStyles";

import { APP_HOME } from "@/constants/routes";
import { useErrorListeners } from "@/libs/http/useErrorListeners";
import ThemeProvider from "@/libs/styles/ThemeProvider";

const PageLoading = dynamic(
	() => import("@/libs/components/loading/PageLoading"),
	{ ssr: false },
);

interface Props {
	children: ReactNode;
}

function Layout({ children }: Readonly<Props>) {
	const pathname = usePathname();
	const checkIsPwaApp = useMemo(
		() => pathname.includes(APP_HOME.path),
		[pathname],
	);

	const { subscribe } = useErrorListeners();

	const handleError = useCallback((err: string | null) => {
		const errorMessage = "درخواست با خطا مواجه شده است";
		showToastEmitter({ message: err ?? errorMessage });
	}, []);

	useEffect(() => {
		const unsubscribe = subscribe(handleError);
		return unsubscribe;
	}, [handleError, subscribe]);

	const hydrated = useHydrated();

	if (!hydrated) {
		return <PageLoading />;
	}

	return (
		<AppRouterCacheProvider>
			<ThemeProvider>
				<GlobalStyles />
				{checkIsPwaApp ? (
					<PwaLayout>{children}</PwaLayout>
				) : (
					<LandingLayout>{children}</LandingLayout>
				)}
			</ThemeProvider>
			<ToastContainer />
		</AppRouterCacheProvider>
	);
}

export default memo(Layout);
