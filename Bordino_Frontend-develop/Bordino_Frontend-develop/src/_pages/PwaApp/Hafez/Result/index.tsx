"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import useGetFortuneReading from "@/api/entertainment/hooks/useGetFortuneReading";
import { parseHafezResult } from "@/api/entertainment/types/fortuneReadingType";
import { HAFEZ } from "@/constants/routes";

const PAGE_BG = "#F9F9F9";
const TEXT_DARK = "#353535";
const BACK_COLOR = "#3C3C3C";
const BTN_RED = "#E64056";
const BTN_BLUE_TEXT = "#235789";

export default function HafezResultPage() {
	const { push } = useRouter();
	const { fortune, loading, error, fetchFortune } = useGetFortuneReading();

	useEffect(() => {
		fetchFortune();
	}, [fetchFortune]);

	const parsed = fortune ? parseHafezResult(fortune.result) : null;

	return (
		<div
			style={{
				minHeight: "100dvh",
				background: PAGE_BG,
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* نوار بازگشت */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "flex-end",
					padding: "12px 16px",
					direction: "rtl",
				}}
			>
				<button
					onClick={() => push(HAFEZ.path)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 4,
						background: "none",
						border: "none",
						cursor: "pointer",
						color: BACK_COLOR,
						fontSize: 16,
						fontWeight: 700,
					}}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M9 18L15 12L9 6"
							stroke="#3C3C3C"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					بازگشت
				</button>
			</div>

			{/* محتوا */}
			<div
				style={{
					flex: 1,
					padding: "0 16px 24px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
				}}
			>
				{/* حالت لودینگ */}
				{loading && (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 16,
							color: TEXT_DARK,
							direction: "rtl",
						}}
					>
						در حال گرفتن فال...
					</div>
				)}

				{/* حالت خطا */}
				{error && (
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 16,
							direction: "rtl",
						}}
					>
						<p style={{ color: TEXT_DARK, fontSize: 14 }}>
							فال دریافت نشد. دوباره امتحان کنید.
						</p>
						<button
							onClick={fetchFortune}
							style={{
								padding: "8px 24px",
								background: BTN_RED,
								color: "#fff",
								border: "none",
								borderRadius: 4,
								fontSize: 14,
								cursor: "pointer",
							}}
						>
							تلاش مجدد
						</button>
					</div>
				)}

				{/* نتیجه فال */}
				{parsed && (
					<>
						{/* تصویر کاغذ وینتیج با شعر */}
						<div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
							<img
								src="/media/App/hafez/paper.png"
								alt=""
								style={{ width: "100%", display: "block", objectFit: "cover" }}
							/>

							{/* عنوان غزل */}
							<div
								style={{
									position: "absolute",
									top: 16,
									right: 16,
									fontSize: 14,
									fontWeight: 500,
									color: TEXT_DARK,
									direction: "rtl",
								}}
							>
								{fortune?.question}
							</div>

							{/* دو ستون شعر */}
							<div
								style={{
									position: "absolute",
									top: 40,
									left: 16,
									right: 16,
									bottom: 16,
									display: "flex",
									flexDirection: "row",
									gap: 8,
									direction: "rtl",
								}}
							>
								<div
									style={{
										flex: 1,
										fontSize: 11,
										fontWeight: 400,
										lineHeight: "24px",
										color: "#000",
										textAlign: "center",
										whiteSpace: "pre-line",
										fontFamily: "serif",
									}}
								>
									{parsed.rightCol.join("\n")}
								</div>
								<div
									style={{
										flex: 1,
										fontSize: 11,
										fontWeight: 400,
										lineHeight: "24px",
										color: "#000",
										textAlign: "center",
										whiteSpace: "pre-line",
										fontFamily: "serif",
									}}
								>
									{parsed.leftCol.join("\n")}
								</div>
							</div>
						</div>

						{/* تفسیر فال */}
						<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							<p
								style={{
									margin: 0,
									fontSize: 12,
									fontWeight: 400,
									color: TEXT_DARK,
									textAlign: "right",
									direction: "rtl",
								}}
							>
								تعبیر فال شما:
							</p>
							<p
								style={{
									margin: 0,
									fontSize: 10,
									fontWeight: 400,
									lineHeight: "18px",
									color: TEXT_DARK,
									textAlign: "center",
									direction: "rtl",
								}}
							>
								{parsed.interpretation}
							</p>
						</div>

						{/* پخش صوت */}
						{fortune?.audio_url && (
							<audio
								controls
								src={fortune.audio_url}
								style={{ width: "100%", direction: "ltr" }}
							/>
						)}

						{/* دکمه‌های عملیاتی */}
						<div
							style={{
								display: "flex",
								flexDirection: "row-reverse",
								gap: 12,
								marginTop: "auto",
							}}
						>
							<button
								onClick={fetchFortune}
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
								فال مجدد
							</button>
							<button
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
								اشتراک گذاری
							</button>
						</div>

						{/* بنر پایین */}
						<div style={{ borderRadius: 12, overflow: "hidden" }}>
							<img
								src="/media/App/hafez/banner.png"
								alt=""
								style={{ width: "100%", display: "block", objectFit: "cover", height: 69 }}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
