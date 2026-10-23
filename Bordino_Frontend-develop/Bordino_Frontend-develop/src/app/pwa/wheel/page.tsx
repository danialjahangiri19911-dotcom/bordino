"use client";

import React, { Suspense, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useRouter, useSearchParams } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import useGetWheel from "@/api/lottery/hooks/useGetWheel";
import useSpinWheel from "@/api/lottery/hooks/useSpinWheel";
import type { WheelPrize } from "@/api/lottery/types/getWheelType";
import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import { MAIN_APP } from "@/constants/routes";
import LuckyWheel from "@/libs/components/games/Roulette";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";

const SLICE_PALETTE = ["#4459D8", "#E64056", "#7B3FC0"];
// گردونهٔ نمونه (seed) — با `python manage.py seed_wheel` ساخته می‌شود
const DEFAULT_WHEEL_ID = "11111111-1111-1111-1111-111111111111";

/** «۲۰ امتیاز» / «۵۰٬۰۰۰ تومان» for a prize amount (already × multiplier). */
function prizeLabel(amount: number, type: WheelPrize["prize_type"]) {
	return `${amount.toLocaleString("fa-IR")} ${type === "cash" ? "تومان" : "امتیاز"}`;
}

function WheelContent() {
	const { push, back } = useRouter();
	const searchParams = useSearchParams();
	const wheelId = searchParams.get("wheel") ?? DEFAULT_WHEEL_ID;

	const {
		data: wheelData,
		isLoading: wheelLoading,
		error: wheelError,
		refetch: refetchWheel,
	} = useGetWheel({ id: wheelId });
	const wheel = wheelData?.result;
	const prizes = useMemo(
		() => wheel?.lottery_wheel_prizes ?? [],
		[wheel?.lottery_wheel_prizes],
	);

	const { data: pointsData, refetch: refetchPoints } = useGetPointsSummary();
	const tokenAccountId = pointsData?.result?.token_wallet_accounts?.[0]?.id;

	const { spinAsync } = useSpinWheel();

	// ضریبِ انتخابیِ کاربر (۱..۵)؛ پیش‌فرض ۱ (پایه)
	const [multiplier, setMultiplier] = useState(1);
	// What the server actually awarded on the last spin: its slice shows this label, so the win
	// dialog announces the paid amount, not a label fetched before an admin edit.
	const [awarded, setAwarded] = useState<{ id: WheelPrize["id"]; label: string } | null>(null);

	// اسلایس‌ها با احتمالِ تعدیل‌شده‌ی ضریب M:
	//  - جوایزِ غیرپوچ: اندازه = probability/M و مبلغِ نمایش = prize_amount×M
	//  - پوچ: سهمِ آزادشده را جذب می‌کند (بزرگ‌تر می‌شود)
	const items = useMemo(() => {
		const M = Math.max(1, multiplier);
		const nonEmpties = prizes.filter((p) => p.prize_type !== "empty");
		const empties = prizes.filter((p) => p.prize_type === "empty");
		const nonEmptySize = (prob: number) => Math.max(1, Math.round((prob || 0) / M));
		const sumNonEmpty = nonEmpties.reduce(
			(s, p) => s + nonEmptySize(p.probability),
			0,
		);
		const emptyTotal = Math.max(0, 100 - sumNonEmpty);
		const emptyBase = empties.reduce((s, p) => s + (p.probability || 0), 0);

		return prizes.map((p) => {
			const isEmpty = p.prize_type === "empty";
			let size: number;
			if (isEmpty) {
				size =
					empties.length === 1
						? emptyTotal
						: emptyBase > 0
							? Math.round((p.probability / emptyBase) * emptyTotal)
							: Math.round(emptyTotal / empties.length);
			} else {
				size = nonEmptySize(p.probability);
			}
			let label = p.name;
			if (!isEmpty) {
				label = prizeLabel(Number(p.prize_amount || 0) * M, p.prize_type);
			}
			if (awarded && awarded.id === p.id) label = awarded.label;
			return { option: label, optionSize: Math.max(1, size) };
		});
	}, [prizes, multiplier, awarded]);

	const cost = Number(wheel?.cost_per_spin ?? 0);

	const handleSpinRequest = async () => {
		if (!wheelId || !tokenAccountId) {
			throw new Error("گردونه یا کیف‌پول آماده نیست");
		}
		const res = await spinAsync({
			lottery_wheel: wheelId,
			token_wallet_account: tokenAccountId,
			multiplier,
		});
		// به‌روزرسانی امتیازِ کیف‌پول (هزینهٔ چرخش کم و جایزه واریز شده)
		void refetchPoints();
		// نگاشتِ جایزهٔ سرور به اسلایس با id
		const won = res.result?.prize;
		const idx = prizes.findIndex((p) => p.id === won?.id);
		if (!won || idx < 0) {
			// A prize this page does not know (the wheel changed): reload it and say what was won,
			// rather than landing on an unrelated slice.
			void refetchWheel();
			toast.info(
				won
					? `نتیجه: ${won.prize_type === "empty" ? "پوچ" : prizeLabel(Number(won.prize_amount || 0), won.prize_type)}`
					: "نتیجهٔ چرخش دریافت نشد؛ کیف پول را ببینید.",
			);
			throw new Error("unknown prize");
		}
		setAwarded(
			won.prize_type === "empty"
				? null
				: { id: won.id, label: prizeLabel(Number(won.prize_amount || 0), won.prize_type) },
		);
		return idx;
	};

	// No wheel to spin (loading, failed, none active): say so — never a local demo that "wins".
	if (!prizes.length) {
		return (
			<PwaAppPageLayout hasHeader={false} sx={{ mx: 0, p: 0, gap: 0 }}>
				<Box sx={{ minHeight: "100vh", bgcolor: "#240620", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 3, textAlign: "center" }}>
					<Typography sx={{ fontSize: 16, fontWeight: 700 }}>
						{wheelLoading
							? "در حال بارگذاری گردونه…"
							: wheelError
								? "گردونه بارگذاری نشد."
								: "گردونهٔ فعالی در حال حاضر نیست."}
					</Typography>
					{!wheelLoading && (
						<Box sx={{ display: "flex", gap: 1 }}>
							{wheelError && (
								<Button variant="contained" onClick={() => refetchWheel()}>
									دوباره تلاش کن
								</Button>
							)}
							<Button variant="outlined" color="inherit" onClick={() => push(MAIN_APP.path)}>
								خانه
							</Button>
						</Box>
					)}
				</Box>
			</PwaAppPageLayout>
		);
	}

	return (
		<PwaAppPageLayout hasHeader={false} sx={{ mx: 0, p: 0, gap: 0 }}>
			<LuckyWheel
				items={items}
				title={wheel?.name ? `💫 ${wheel.name} 💫` : "💫 چرخونه شانسی 💫"}
				// The price is on the button: the spin costs it at every multiplier.
				buttonLabel={cost > 0 ? `بگردون! (${cost.toLocaleString("fa-IR")} امتیاز)` : "بگردون!"}
				showTicketBadge
				wheelBackgroundColors={SLICE_PALETTE}
				config={{
					radiusLineColor: "#D69136",
					radiusLineWidth: 2,
					fontSize: 18,
					fontWeight: 700,
					textDistance: 75,
					spinDuration: 0.8,
					perpendicularText: false,
				}}
				emptyPrizeLabel="پوچ"
				onSpinRequest={handleSpinRequest}
				defaultMultiplier="1x"
				onMultiplierChange={(m) =>
					setMultiplier(Number(m.replace(/[^0-9]/g, "")) || 1)
				}
				onBack={back}
				onHome={() => push(MAIN_APP.path)}
			/>
		</PwaAppPageLayout>
	);
}

export default function WheelPage() {
	return (
		<Suspense
			fallback={<Box sx={{ minHeight: "100vh", bgcolor: "#240620" }} />}
		>
			<WheelContent />
		</Suspense>
	);
}
