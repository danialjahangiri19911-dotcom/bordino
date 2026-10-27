"use client";

import type { ReactNode } from "react";
import React, { memo, useCallback, useEffect } from "react";
import { ToastContainer } from "react-toastify";

import { usePathname } from "next/navigation";

import useHydrated from "./useHydrated";
import showToastEmitter from "@libs/components/toasts/ToastEmitter/showToastEmitter";
import { AppRouterCacheProvider } from "@libs/http/AppRouterCacheProvider";
import { GlobalStyles } from "@libs/styles/GlobalStyles";

import BackButton from "@/bd/BackButton";
import { useApplyScheme } from "@/bd/appearance";
import InstallPrompt from "@/bd/InstallPrompt";
import { APP_HOME } from "@/constants/routes";
import { useErrorListeners } from "@/libs/http/useErrorListeners";
import ThemeProvider from "@/libs/styles/ThemeProvider";

interface Props {
	children: ReactNode;
}

/** Every page renders inside #bordino-directions, the scope of the neobrutalism stylesheet. */
function Layout({ children }: Readonly<Props>) {
	const pathname = usePathname();
	const isPwa = pathname.startsWith(APP_HOME.path);
	const scheme = useApplyScheme();

	const { subscribe } = useErrorListeners();

	const handleError = useCallback((err: string | null) => {
		const errorMessage = "درخواست با خطا مواجه شده است";
		showToastEmitter({ message: err ?? errorMessage });
	}, []);

	useEffect(() => {
		const unsubscribe = subscribe(handleError);
		return unsubscribe;
	}, [handleError, subscribe]);

	// The stores (session, user) live in localStorage: render once they are read, so a signed-in
	// player is never sent to the phone page for a frame.
	const hydrated = useHydrated();

	return (
		<AppRouterCacheProvider>
			<ThemeProvider>
				<GlobalStyles />
				<div id="bordino-directions" dir="rtl">
					{hydrated ? (
						children
					) : (
						<div className="bd-boot" role="status" aria-label="در حال بارگذاری">
							<span className="bd-logomark" aria-hidden="true">
								ب
							</span>
						</div>
					)}
					{hydrated && isPwa ? <InstallPrompt /> : null}
					{/* The Android app's Back button (does nothing in a browser). */}
					{hydrated ? <BackButton /> : null}
				</div>
			</ThemeProvider>
			<ToastContainer rtl position="top-center" theme={scheme === "dark" ? "dark" : "light"} />
		</AppRouterCacheProvider>
	);
}

export default memo(Layout);
