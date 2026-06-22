"use client";

import { useRouter } from "next/navigation";

import { HAFEZ_RESULT, MAIN_APP } from "@/constants/routes";

const PAGE_BG = "#0D102A";
const SHEET_BG = "#FFFFFF";
const TITLE_COLOR = "#222222";
const DESC_COLOR = "#525252";
const BTN_RED = "#E64056";
const BTN_BLUE_TEXT = "#235789";

export default function HafezPage() {
	const { push } = useRouter();

	return (
		<div
			style={{
				minHeight: "100dvh",
				background: PAGE_BG,
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Panda illustration */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					display: "flex",
					justifyContent: "center",
					paddingTop: 80,
				}}
			>
				<img
					src="/media/App/hafez/panda.png"
					alt="فال حافظ"
					style={{ width: 128, height: 147, objectFit: "contain" }}
				/>
			</div>

			{/* Bottom sheet */}
			<div
				style={{
					background: SHEET_BG,
					borderRadius: "24px 24px 0 0",
					padding: "24px 16px 32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
				}}
			>
				{/* Header row: title + icon */}
				<div
					style={{
						display: "flex",
						flexDirection: "row-reverse",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<span
						style={{
							fontSize: 20,
							fontWeight: 700,
							color: TITLE_COLOR,
						}}
					>
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
						marginTop: 8,
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
						onClick={() => push(MAIN_APP.path)}
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
	);
}
