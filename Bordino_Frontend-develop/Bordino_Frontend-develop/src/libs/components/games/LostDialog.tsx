"use client";

import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

interface Props {
	open: boolean;
	/** عنوان (پیش‌فرض «باختی!») */
	title?: string;
	/** توضیحِ علتِ باخت (بسته به بازی) */
	description: string;
	/** موجودیِ فعلیِ امتیازِ کاربر */
	points: number;
	/** هزینهٔ کسرشونده برای ادامهٔ بازی */
	cost: number;
	/** در حالِ کسرِ امتیاز (دکمه را غیرفعال می‌کند) */
	loading?: boolean;
	onContinue: () => void;
	onCancel: () => void;
}

/** دیالوگِ باخت — مطابقِ Figma: «کسر X امتیاز از کیف امتیاز و ادامه بازی». */
export default function LostDialog({
	open,
	title = "باختی!",
	description,
	points,
	cost,
	loading = false,
	onContinue,
	onCancel,
}: Readonly<Props>) {
	if (!open) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1300,
				background: "rgba(0,0,0,0.5)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				direction: "rtl",
			}}
		>
			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 360,
					background: "#fff",
					borderRadius: 24,
					padding: "24px 20px 20px",
					boxSizing: "border-box",
				}}
			>
				{/* بستن (چپ در RTL) */}
				<button
					type="button"
					onClick={onCancel}
					aria-label="بستن"
					style={{
						position: "absolute",
						top: 16,
						left: 16,
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: 4,
						lineHeight: 0,
					}}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
						<path
							d="M6 6l12 12M18 6L6 18"
							stroke="#5B5B5B"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</button>

				<h2
					style={{
						margin: 0,
						textAlign: "center",
						color: "#353535",
						fontSize: 22,
						fontWeight: 800,
					}}
				>
					{title}
				</h2>

				<p
					style={{
						margin: "10px 0 0",
						textAlign: "center",
						color: "#525252",
						fontSize: 15,
						lineHeight: 1.7,
					}}
				>
					{description}
				</p>

				{/* امتیازِ کاربر */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
						marginTop: 14,
					}}
				>
					<span style={{ color: "#000", fontSize: 14 }}>امتیاز تو:</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							background: "#FDECEE",
							color: "#D13A4E",
							borderRadius: 32,
							padding: "4px 12px",
							fontSize: 14,
							fontWeight: 600,
						}}
					>
						<span
							style={{
								width: 18,
								height: 18,
								borderRadius: "50%",
								background: "#D13A4E",
								color: "#fff",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 11,
								fontWeight: 700,
							}}
						>
							Ł
						</span>
						{toPersianDigits(points)} امتیاز
					</span>
				</div>

				{/* ادامهٔ بازی با کسرِ امتیاز */}
				<button
					type="button"
					onClick={onContinue}
					disabled={loading}
					style={{
						width: "100%",
						marginTop: 20,
						background: "#fff",
						border: "1.5px solid #E64056",
						borderRadius: 8,
						color: "#E64056",
						fontSize: 15,
						fontWeight: 700,
						padding: "13px 12px",
						cursor: loading ? "default" : "pointer",
						opacity: loading ? 0.6 : 1,
						fontFamily: "inherit",
					}}
				>
					کسر {toPersianDigits(cost)} امتیاز از کیف امتیاز و ادامه بازی
				</button>

				<button
					type="button"
					onClick={onCancel}
					style={{
						width: "100%",
						marginTop: 12,
						background: "none",
						border: "none",
						color: "#E64056",
						fontSize: 15,
						fontWeight: 700,
						cursor: "pointer",
						fontFamily: "inherit",
					}}
				>
					انصراف
				</button>
			</div>
		</div>
	);
}
