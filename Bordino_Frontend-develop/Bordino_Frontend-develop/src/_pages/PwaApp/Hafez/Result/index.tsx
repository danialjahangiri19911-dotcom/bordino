"use client";

import { useRouter } from "next/navigation";

import { HAFEZ, MAIN_APP } from "@/constants/routes";

const PAGE_BG = "#F9F9F9";
const TEXT_DARK = "#353535";
const BACK_COLOR = "#3C3C3C";
const BTN_RED = "#E64056";
const BTN_BLUE_TEXT = "#235789";

const POEM_RIGHT =
	"در حق ما هر چه گويد جای هيچ اکراه نيست\nدر صراط مستقيم ای دل کسی گمراه نيست\nعرصه شطرنج رندان را مجال شاه نيست\nزين معما هيچ دانا در جهان آگاه نيست\nکاين همه زخم نهان هست و مجال آه نيست\nکاندر اين طغرا نشان حسبه لله نيست\nکبر و ناز و حاجب و دربان بدين درگاه نيست\nخودفروشان را به کوی می فروشان راه نيست\nور نه تشريف تو بر بالای کس کوتاه نيست\nور نه لطف شيخ و زاهد گاه هست و گاه نيست\nعاشق دردی کش اندربند مال و جاه نيست";

const POEM_LEFT =
	"زاهد ظاهرپرست از حال ما آگاه نيست\nدر طريقت هر چه پيش سالک آيد خير اوست\nتا چه بازی رخ نمايد بيدقی خواهيم راند\nچيست اين سقف بلند ساده بسيارنقش\nاين چه استغناست يا رب وين چه قادر حکمت است\nصاحب ديوان ما گويی نمی‌داند حساب\nهر که خواهد گو بيا و هر چه خواهد گو بگو\nبر در ميخانه رفتن کار يک رنگان بود\nهر چه هست از قامت ناساز بی اندام ماست\nبنده پير خراباتم که لطفش دايم است\nحافظ ار بر صدر ننشيند ز عالی مشربيست";

const INTERPRETATION =
	"دوست گرامی، مراقب اطرافیان خود باش؛ زیرا به هیچ‌وجه نمی‌توان از ظاهر افراد به نیات و باطنِ آنها پی برد و قضاوت کرد. در کار خیر حاجت به هیچ‌گونه مشورت و استخاره نیست؛ به خدا توکل کن و اقدام کن. از طعنه‌ها و عیب‌جویی‌های ناآگاهان و بخیلان هراس به خود راه نده و برای خودت زندگی کن. فریب ظواهر و زیبایی‌های زودگذر زندگی را نخور و از ریا و دورویی پرهیز کن تا موفق شوی، ان‌شاءالله.";

export default function HafezResultPage() {
	const { push } = useRouter();

	return (
		<div
			style={{
				minHeight: "100dvh",
				background: PAGE_BG,
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Top navigation bar */}
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "12px 16px",
				}}
			>
				{/* Back button (right side in RTL) */}
				<div style={{ width: 24 }} />
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
						direction: "rtl",
					}}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M15 18L9 12L15 6"
							stroke="#3C3C3C"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					بازگشت
				</button>
			</div>

			{/* Content area */}
			<div style={{ flex: 1, padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
				{/* Vintage paper with poem */}
				<div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
					<img
						src="/media/App/hafez/paper.png"
						alt=""
						style={{ width: "100%", display: "block", objectFit: "cover" }}
					/>

					{/* Ghazal number overlay */}
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
						غزل ۷۱
					</div>

					{/* Poem columns */}
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
								fontSize: 12,
								fontWeight: 400,
								lineHeight: "26px",
								color: "#000000",
								textAlign: "center",
								whiteSpace: "pre-line",
								fontFamily: "serif",
							}}
						>
							{POEM_RIGHT}
						</div>
						<div
							style={{
								flex: 1,
								fontSize: 12,
								fontWeight: 400,
								lineHeight: "26px",
								color: "#000000",
								textAlign: "center",
								whiteSpace: "pre-line",
								fontFamily: "serif",
							}}
						>
							{POEM_LEFT}
						</div>
					</div>
				</div>

				{/* Interpretation section */}
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
						{INTERPRETATION}
					</p>
				</div>

				{/* Action buttons */}
				<div
					style={{
						display: "flex",
						flexDirection: "row-reverse",
						gap: 12,
						marginTop: "auto",
					}}
				>
					<button
						onClick={() => push(HAFEZ.path)}
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

				{/* Bottom banner */}
				<div style={{ borderRadius: 12, overflow: "hidden" }}>
					<img
						src="/media/App/hafez/banner.png"
						alt=""
						style={{ width: "100%", display: "block", objectFit: "cover", height: 69 }}
					/>
				</div>
			</div>
		</div>
	);
}
