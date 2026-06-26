"use client";

import React, { Suspense, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import Box from "@mui/material/Box";

import useGetWheel from "@/api/lottery/hooks/useGetWheel";
import useSpinWheel from "@/api/lottery/hooks/useSpinWheel";
import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import { MAIN_APP } from "@/constants/routes";
import LuckyWheel from "@/libs/components/games/Roulette";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";

const SLICE_PALETTE = ["#4459D8", "#E64056", "#7B3FC0"];
// گردونهٔ نمونه (seed) — با `python manage.py seed_wheel` ساخته می‌شود
const DEFAULT_WHEEL_ID = "11111111-1111-1111-1111-111111111111";
// در نبودِ دادهٔ سرور، گردونه به‌صورت دمو (انتخاب تصادفیِ کلاینت) نمایش داده می‌شود
const DEMO_ITEMS = [
	{ option: "۵۰۰٬۰۰۰ تومان" },
	{ option: "۲۰۰٬۰۰۰ تومان" },
	{ option: "۱۰۰٬۰۰۰ تومان" },
	{ option: "۵۰٬۰۰۰ تومان" },
	{ option: "پوچ" },
];

function WheelContent() {
	const { push, back } = useRouter();
	const searchParams = useSearchParams();
	const wheelId = searchParams.get("wheel") ?? DEFAULT_WHEEL_ID;

	const { data: wheelData } = useGetWheel({ id: wheelId });
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
				const amount = Number(p.prize_amount || 0) * M;
				const unit = p.prize_type === "cash" ? "تومان" : "امتیاز";
				label = `${amount.toLocaleString("fa-IR")} ${unit}`;
			}
			return { option: label, optionSize: Math.max(1, size) };
		});
	}, [prizes, multiplier]);

	// گردونهٔ سرور موجود است؟ وگرنه دمو
	const hasServerWheel = items.length > 0;
	const finalItems = hasServerWheel ? items : DEMO_ITEMS;

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
		const idx = prizes.findIndex((p) => p.id === res.result?.prize?.id);
		return idx >= 0 ? idx : 0;
	};

	return (
		<PwaAppPageLayout hasHeader={false} sx={{ mx: 0, p: 0, gap: 0 }}>
			<LuckyWheel
				items={finalItems}
				title={wheel?.name ? `💫 ${wheel.name} 💫` : "💫 چرخونه شانسی 💫"}
				buttonLabel="بگردون!"
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
				onSpinRequest={hasServerWheel ? handleSpinRequest : undefined}
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
