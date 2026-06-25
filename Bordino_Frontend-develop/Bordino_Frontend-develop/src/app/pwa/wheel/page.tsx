"use client";

import React, { Suspense, useMemo } from "react";

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

	// اسلایس‌ها = جوایزِ گردونه (به‌تعدادِ سطرها)
	const items = useMemo(() => prizes.map((p) => ({ option: p.name })), [prizes]);

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
				defaultMultiplier="5x"
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
