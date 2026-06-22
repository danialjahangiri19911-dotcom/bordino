"use client";

import { useRouter } from "next/navigation";

import { HAFEZ_RESULT, MAIN_APP } from "@/constants/routes";

interface Props {
	open: boolean;
	onClose: () => void;
}

const BTN_RED = "#E64056";
const BTN_BLUE_TEXT = "#235789";
const TITLE_COLOR = "#222222";
const DESC_COLOR = "#525252";

export default function HafezDrawer({ open, onClose }: Props) {
	const { push } = useRouter();

	if (!open) return null;

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1200,
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
			}}
		>
			{/* Dark backdrop */}
			<div
				onClick={onClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "rgba(13,16,42,0.88)",
				}}
			/>

			{/* Bottom sheet — 395px, matches Figma */}
			<div
				style={{
					position: "relative",
					width: "100%",
					height: 395,
					background: "#FFFFFF",
					borderRadius: "24px 24px 0 0",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* Panda image — y=19 from sheet top, horizontally centered (Figma: x=131 of 390) */}
				<div
					style={{
						position: "absolute",
						top: 19,
						left: "50%",
						transform: "translateX(-50%)",
						width: 128,
						height: 147,
						pointerEvents: "none",
					}}
				>
					<img
						src="/media/App/hafez/panda.png"
						alt=""
						style={{ width: "100%", height: "100%", objectFit: "contain" }}
					/>
				</div>

				{/* Content starts at y=162 (matching Figma frame offset) */}
				<div
					style={{
						position: "absolute",
						top: 162,
						left: 16,
						right: 16,
						display: "flex",
						flexDirection: "column",
						gap: 12,
					}}
				>
					{/* Header row: title right, icon left */}
					<div
						style={{
							display: "flex",
							flexDirection: "row-reverse",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<span style={{ fontSize: 20, fontWeight: 700, color: TITLE_COLOR }}>
							فال حافظ
						</span>
						<img
							src="/media/App/hafez/icon.png"
							alt=""
							style={{ width: 40, height: 40, objectFit: "contain" }}
						/>
					</div>

					{/* Separator */}
					<div style={{ height: 1, background: "#EBEBEB" }} />

					{/* Description */}
					<p
						style={{
							margin: 0,
							fontSize: 14,
							fontWeight: 400,
							lineHeight: "22px",
							color: DESC_COLOR,
							textAlign: "right",
							direction: "rtl",
						}}
					>
						نیت کن و روی دکمه‌ی گرفتن فال بزن. امیدوارم فال تو با دلت هم‌خوانی داشته باشه.
					</p>

					{/* Buttons */}
					<div
						style={{
							display: "flex",
							flexDirection: "row-reverse",
							gap: 12,
							marginTop: 4,
						}}
					>
						<button
							onClick={() => push(HAFEZ_RESULT.path)}
							style={{
								flex: 1,
								height: 40,
								background: BTN_RED,
								color: "#FFFFFF",
								border: "none",
								borderRadius: 4,
								fontSize: 16,
								fontWeight: 500,
								cursor: "pointer",
							}}
						>
							فال
						</button>
						<button
							onClick={onClose}
							style={{
								flex: 1,
								height: 40,
								background: "#FFFFFF",
								color: BTN_BLUE_TEXT,
								border: `1.5px solid ${BTN_BLUE_TEXT}`,
								borderRadius: 4,
								fontSize: 16,
								fontWeight: 500,
								cursor: "pointer",
							}}
						>
							انصراف
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
