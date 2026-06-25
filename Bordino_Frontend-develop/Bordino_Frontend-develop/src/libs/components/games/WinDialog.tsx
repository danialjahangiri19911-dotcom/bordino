"use client";

import { useState } from "react";

import ButtonBase from "@mui/material/ButtonBase";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";

interface Props {
	open: boolean;
	/** مبلغ/جایزهٔ برده‌شده، مثل «۵۰۰٬۰۰۰ تومان» */
	prize: string;
	/** حالتِ پوچ (جایزه‌ای برده نشده) */
	isEmpty?: boolean;
	onClose?: () => void;
	onSpinAgain?: () => void;
	onHome?: () => void;
}

/** پیامِ نتیجهٔ چرخش — برد (نقدی/امتیازی) یا پوچ — بر اساس طراحیِ Figma (bottom sheet) */
export default function WinDialog({
	open,
	prize,
	isEmpty = false,
	onClose,
	onSpinAgain,
	onHome,
}: Readonly<Props>) {
	const [imgError, setImgError] = useState(false);

	// نوعِ جایزه از روی نامش: «... امتیاز» → کیف امتیاز، وگرنه کیف پول نقدی
	const isPoints = prize.includes("امتیاز");
	const walletLabel = isPoints ? "کیف امتیاز" : "کیف پول نقدی";

	return (
		<BaseDrawer
			open={open}
			onClose={onClose}
			sx={{
				direction: "rtl",
				"& .MuiPaper-root": {
					borderTopLeftRadius: 16,
					borderTopRightRadius: 16,
				},
			}}
		>
			<Content>
				<Illustration>
					{imgError ? (
						<EmojiFallback>{isEmpty ? "😔" : "🎉"}</EmojiFallback>
					) : (
						<img
							src={
								isEmpty
									? "/media/App/wheel/lose-illustration.png"
									: "/media/App/wheel/win-illustration.png"
							}
							alt=""
							onError={() => setImgError(true)}
							style={{ width: "100%", height: "100%", objectFit: "contain" }}
						/>
					)}
				</Illustration>

				{isEmpty ? (
					<WinTitle variant="18-medium" style={{ color: "#BE1919" }}>
						متاسفم شما پوچ شدی.
					</WinTitle>
				) : (
					<>
						<WinTitle variant="18-medium">
							تبریک، {prize} برنده شدی :)
						</WinTitle>
						<WinDesc variant="14-regular">
							شما برنده جایزه {prize} مسابقه چرخونه شانسی شدید. این مبلغ
							در <WalletName>{walletLabel}</WalletName> شما اضافه شد.
						</WinDesc>
					</>
				)}

				<Buttons>
					<OutlineButton onClick={onHome}>
						<HomeIcon viewBox="0 0 24 24" aria-hidden>
							<path
								d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
								fill="none"
								stroke="#235789"
								strokeWidth="1.6"
								strokeLinejoin="round"
							/>
						</HomeIcon>
						<Typography variant="16-medium" sx={{ color: "#235789" }}>
							بازگشت به خانه
						</Typography>
					</OutlineButton>

					<FilledButton onClick={onSpinAgain}>
						<RefreshIcon viewBox="0 0 24 24" aria-hidden>
							<path
								d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
								fill="#2E2E2E"
							/>
						</RefreshIcon>
						<Typography variant="16-medium" sx={{ color: "#2E2E2E" }}>
							چرخاندن مجدد
						</Typography>
					</FilledButton>
				</Buttons>
			</Content>
		</BaseDrawer>
	);
}

const Content = styled(Box)({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	padding: "8px 16px 24px",
	gap: 12,
});

const Illustration = styled(Box)({
	width: 223,
	maxWidth: "70%",
	height: 185,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

const EmojiFallback = styled("span")({
	fontSize: 96,
	lineHeight: 1,
});

const WinTitle = styled(Typography)({
	color: "#046146",
	fontWeight: 600,
});

const WinDesc = styled(Typography)({
	color: "#525252",
	lineHeight: 1.7,
	maxWidth: 326,
});

const WalletName = styled("span")({
	color: "#235789",
	fontWeight: 500,
});

const Buttons = styled(Box)({
	display: "flex",
	gap: 12,
	width: "100%",
	maxWidth: 358,
	marginTop: 12,
});

const buttonBase = {
	flex: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 6,
	height: 40,
	borderRadius: 4,
} as const;

const OutlineButton = styled(ButtonBase)({
	...buttonBase,
	backgroundColor: "#FFFFFF",
	border: "1px solid #235789",
});

const FilledButton = styled(ButtonBase)({
	...buttonBase,
	backgroundColor: "#FFC46B",
	border: "1px solid #EFB763",
});

const HomeIcon = styled("svg")({
	width: 20,
	height: 20,
	flexShrink: 0,
});

const RefreshIcon = styled("svg")({
	width: 20,
	height: 20,
	flexShrink: 0,
});
