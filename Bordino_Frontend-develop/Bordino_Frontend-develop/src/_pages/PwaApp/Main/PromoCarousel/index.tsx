"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { TAROT, WHEEL } from "@/constants/routes";
import Box from "@libs/components/atoms/Box";
import "swiper/css";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const ACTIVE_DOT = "#E64056";
const INACTIVE_DOT = "#CBCBCB";
const TITLE_COLOR = "#F9F9F9";
const SUBTITLE_COLOR = "#E9EEF3";
const PILL_BG = "#F9F9F9";

interface EllipseSpec {
	left: number;
	top: number;
	w: number;
	h: number;
	color: string;
	opacity?: number;
	blur?: number; // معادل CSS blur (تقریباً نصف radius فیگما)
}

interface SlideSpec {
	key: string;
	bg: string;
	image: string;
	/** اگر تصویری نباشد، این اموجی در جای تصویر نمایش داده می‌شود */
	emoji?: string;
	img: { left: number; top: number; width: number; height: number };
	title: string;
	subtitle: string;
	buttonText: string;
	buttonTextColor: string;
	href?: string;
	ellipses: EllipseSpec[];
}

const SLIDES: SlideSpec[] = [
	{
		key: "hafez",
		bg: "#960D10",
		image: "/media/App/main/hafez.png",
		img: { left: 19, top: 0, width: 110, height: 113 },
		title: "فال حافظ",
		subtitle: "بیا بریم فال حافظ امروزتو بگیریم",
		buttonText: "بریم",
		buttonTextColor: "#E64056",
		href: "/pwa/hafez",
		ellipses: [
			{ left: -2, top: 0, w: 152, h: 106, color: "#FF0505", opacity: 0.6, blur: 25 },
			{ left: 10, top: 96, w: 123, h: 10, color: "#BB1D1D" },
			{ left: 275, top: 43, w: 68, h: 62, color: "#FF9D9D", opacity: 0.2, blur: 10 },
		],
	},
	{
		key: "spin",
		bg: "#1A4167",
		image: "/media/App/main/spin-wheel.png",
		img: { left: 42, top: 20, width: 86, height: 86 },
		title: "بچرخون و جایزه ببر!",
		subtitle: "یه چرخش هیجان‌انگیز.",
		buttonText: "جایزه بگیر",
		buttonTextColor: "#235789",
		href: WHEEL.path,
		ellipses: [
			{ left: 206, top: 65, w: 152, h: 79, color: "#204E7B" },
			{ left: -90, top: 10, w: 152, h: 79, color: "#204E7B" },
		],
	},
	{
		key: "tarot",
		bg: "#3A1D5E",
		image: "",
		emoji: "🔮",
		img: { left: 30, top: 16, width: 78, height: 78 },
		title: "فال تاروت",
		subtitle: "کارت‌هاتو رو کن و آینده‌تو ببین",
		buttonText: "بریم",
		buttonTextColor: "#3A1D5E",
		href: TAROT.path,
		ellipses: [
			{ left: -10, top: -6, w: 150, h: 100, color: "#7B3FC0", opacity: 0.5, blur: 26 },
			{ left: 250, top: 40, w: 80, h: 70, color: "#C9A24B", opacity: 0.18, blur: 14 },
		],
	},
];

function PromoCard({ slide, onActivate }: Readonly<{ slide: SlideSpec; onActivate?: () => void }>) {
	return (
		<div
			onClick={onActivate}
			style={{
				position: "relative",
				width: "100%",
				height: 106,
				borderRadius: 16,
				overflow: "hidden",
				background: slide.bg,
				cursor: onActivate ? "pointer" : "default",
			}}
		>
			{slide.ellipses.map((e, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: e.left,
						top: e.top,
						width: e.w,
						height: e.h,
						borderRadius: "50%",
						background: e.color,
						opacity: e.opacity ?? 1,
						filter: e.blur ? `blur(${e.blur}px)` : undefined,
					}}
				/>
			))}

			{slide.image ? (
				<img
					src={slide.image}
					alt=""
					style={{
						position: "absolute",
						left: slide.img.left,
						top: slide.img.top,
						width: slide.img.width,
						height: slide.img.height,
						objectFit: "contain",
					}}
				/>
			) : slide.emoji ? (
				<div
					style={{
						position: "absolute",
						left: slide.img.left,
						top: slide.img.top,
						width: slide.img.width,
						height: slide.img.height,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: slide.img.height * 0.7,
						lineHeight: 1,
					}}
				>
					{slide.emoji}
				</div>
			) : null}

			{/* بلوک متن، لنگرشده به لبه‌ی راست؛ بدون width ثابت تا متن‌ها یک‌خطی بمانند */}
			<div style={{ position: "absolute", right: 24, top: 18, textAlign: "right" }}>
				<div
					style={{
						whiteSpace: "nowrap",
						fontSize: 16,
						fontWeight: 700,
						lineHeight: "22px",
						color: TITLE_COLOR,
					}}
				>
					{slide.title}
				</div>
				<div
					style={{
						whiteSpace: "nowrap",
						marginTop: 4,
						fontSize: 12,
						fontWeight: 400,
						lineHeight: "16px",
						color: SUBTITLE_COLOR,
					}}
				>
					{slide.subtitle}
				</div>
				<div style={{ marginTop: 4 }}>
					<span
						onClick={(e) => {
							e.stopPropagation();
							onActivate?.();
						}}
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "4px 12px",
							borderRadius: 12,
							background: PILL_BG,
							fontSize: 12,
							fontWeight: 500,
							lineHeight: "16px",
							color: slide.buttonTextColor,
							cursor: "pointer",
						}}
					>
						{slide.buttonText}
					</span>
				</div>
			</div>
		</div>
	);
}

interface PromoCarouselProps {
	onHafezClick?: () => void;
}

export default function PromoCarousel({ onHafezClick }: PromoCarouselProps) {
	const [active, setActive] = useState(0);
	const { push } = useRouter();

	return (
		<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
			<Box sx={{ width: "100%" }}>
				<Swiper
					modules={[Autoplay]}
					autoplay={{ delay: 5000, disableOnInteraction: false }}
					loop
					slidesPerView={1}
					spaceBetween={16}
					onSlideChange={(swiper) => setActive(swiper.realIndex)}
					style={{ width: "100%" }}
				>
					{SLIDES.map((slide) => (
						<SwiperSlide key={slide.key}>
							<PromoCard
								slide={slide}
								onActivate={
									slide.key === "hafez"
										? onHafezClick
										: slide.href
											? () => push(slide.href!)
											: undefined
								}
							/>
						</SwiperSlide>
					))}
				</Swiper>
			</Box>

			{/* direction: ltr تا اسلاید اول → نقطه‌ی چپ فعال باشد (مثل فیگما) */}
			<div style={{ display: "flex", gap: 4, direction: "ltr" }}>
				{SLIDES.map((slide, i) => (
					<div
						key={slide.key}
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: i === active ? ACTIVE_DOT : INACTIVE_DOT,
						}}
					/>
				))}
			</div>
		</Box>
	);
}
