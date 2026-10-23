"use client";

import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { usePathname } from "next/navigation";

import { EXCLUDE_PATHS, PWA_BOTTOM_NAVIGATION } from "./constants";
import BottomNavigation from "@libs/components/BottomNavigation";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import styled from "@libs/styles/styled";

interface Props {
	children: ReactNode;
}

function PwaLayout({ children }: Readonly<Props>) {
	const pathname = usePathname();
	const [showPopup, setShowPopup] = useState(false);
	const deferredPrompt = useRef<any>(null);
	const popupRef = useRef<HTMLDivElement>(null);

	const checkValidation = useMemo(
		() => !EXCLUDE_PATHS.includes(pathname),
		[pathname],
	);

	useEffect(() => {
		if (typeof window === "undefined" || process.env.NODE_ENV === "development")
			return;

		const handleBeforeInstallPrompt = (e: any) => {
			e.preventDefault();
			deferredPrompt.current = e;
			setShowPopup(true);
		};
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, []);

	useEffect(() => {
		if (typeof window === "undefined" || typeof document === "undefined")
			return;

		const handleClickOutside = (e: MouseEvent) => {
			if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
				setShowPopup(false);
			}
		};
		if (showPopup) {
			document.addEventListener("click", handleClickOutside);
		}
		return () => document.removeEventListener("click", handleClickOutside);
	}, [showPopup]);

	const handleInstallClick = async () => {
		if (!deferredPrompt.current) return;
		deferredPrompt.current.prompt();
		setShowPopup(false);
	};

	const isLotteryDetail = pathname.includes("/pwa/lottery/ticket-detail/");

	return (
		<Wrapper>
			<PageWrapper>
				<Box
					// The content area ends where the (58 px + safe area) bottom bar begins.
					height={
						checkValidation && !isLotteryDetail
							? "calc(100dvh - 58px - env(safe-area-inset-bottom, 0px))"
							: "100vh"
					}
					overflow="hidden"
					sx={{
						overflow: "scroll",
						"&::-webkit-scrollbar": {
							display: "none",
						},
						scrollbarWidth: "none",
					}}
					pb={2}
				>
					{children}{" "}
				</Box>

				{showPopup && (
					<PopupHint ref={popupRef}>
						<Button onClick={handleInstallClick}>نصب اپلیکیشن</Button>
					</PopupHint>
				)}
				{checkValidation && !isLotteryDetail && (
					<BottomNavigation items={PWA_BOTTOM_NAVIGATION} />
				)}
			</PageWrapper>
		</Wrapper>
	);
}

const PopupHint = styled(Box)(({ theme }) => ({
	position: "fixed",
	top: theme.spacing(2),
	left: "50%",
	transform: "translateX(-50%)",
	backgroundColor: theme.palette.grey[300],
	color: theme.palette.common.white,
	padding: theme.spacing(1.5, 3),
	borderRadius: theme.spacing(1),
	boxShadow: theme.shadows[4],
	zIndex: 9999,
	cursor: "default",
}));

const PageWrapper = styled(Box)(({ theme }) => ({
	width: "100%",
	minWidth: 320,
	maxWidth: 600,
	display: "flex",
	flexDirection: "column",
	backgroundColor: theme.palette.common.white,
	gap: theme.spacing(4),
}));

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "center",
	backgroundColor: theme.palette.grey[200],
	height: "100dvh",
	position: "relative",
}));

export default memo(PwaLayout);
