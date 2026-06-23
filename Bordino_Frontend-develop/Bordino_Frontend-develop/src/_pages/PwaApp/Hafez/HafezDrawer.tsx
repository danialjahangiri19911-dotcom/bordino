"use client";

import { useRouter } from "next/navigation";

import { HAFEZ_RESULT } from "@/constants/routes";

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
		/*
		 * محدود‌کننده: همان max-width/centering که PageWrapper دارد.
		 * position: fixed + left: 50% + translateX(-50%) مطمئن می‌کند
		 * روی ناحیه خاکستری کنار صفحه نمی‌رود.
		 */
		<div
			style={{
				position: "fixed",
				top: 0,
				bottom: 0,
				left: "50%",
				transform: "translateX(-50%)",
				width: "100%",
				maxWidth: 600,
				zIndex: 1200,
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				pointerEvents: "auto",
			}}
		>
			{/* Dark backdrop — همان محدوده */}
			<div
				onClick={onClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "rgba(13,16,42,0.88)",
				}}
			/>

			{/* Bottom sheet: 395px طبق فیگما */}
			<div
				style={{
					position: "relative",
					width: "100%",
					height: 395,
					background: "#FFFFFF",
					borderRadius: "24px 24px 0 0",
				}}
			>
				{/* تصویر پاندا — y=19 از بالای شیت (طبق فیگما)، وسط‌چین */}
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

				{/* محتوا از y=162 طبق فیگما */}
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
					{/* ردیف بالا: آیکون و عنوان کنار هم، سمت راست (مثل فیگما) */}
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "flex-end",
							gap: 8,
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

					{/* خط جدا‌کننده */}
					<div style={{ height: 1, background: "#EBEBEB" }} />

					{/* متن راهنما */}
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

					{/* دکمه‌ها */}
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
