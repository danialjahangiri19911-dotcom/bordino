"use client";

import React from "react";

import LuckyWheel from "@/libs/components/games/Roulette";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";

export default function GameNetPage() {
	const wheelItems = [
		{ option: "۱۰ هزار تومان" },
		{ option: "۲۰ هزار تومان" },
		{ option: "۵۰ هزار تومان" },
		{ option: "۱۰۰ هزار تومان" },
		{ option: "پوچ خالی " },
	];

	const handleWinPrize = (prize: string) => {
		console.warn("برنده:", prize);
		// TODO: API call برای ثبت برد
	};

	return (
		<PwaAppPageLayout sx={{ mx: 0, p: 0 }}>
			<LuckyWheel
				items={wheelItems}
				title="چرخونه شانسی"
				buttonLabel="بگردون!"
				showTicketBadge
				ticketBadgeLabel="اعتبار"
				ticketBadgeCount={5}
				wheelBackgroundColors={[
					"#FF4444",
					"#3366FF",
					"#FF1493",
					"#00FF66",
					"#FFD700",
					"#FF0066",
				]}
				config={{
					textDistance: 70100,
					fontSize: 17,
					fontWeight: 700,
					innerRadius: 10,
					outerBorderWidth: 5,
					radiusLineWidth: 2,
					spinDuration: 0.8,
					perpendicularText: false,
				}}
				emptyPrizeLabel="پوچ"
				emptyPrizeMessage="متاسفانه این بار شانس با شما یار نبود 😔"
				winMessage="تبریک! شما برنده شدید"
				handleWin={handleWinPrize}
			/>
		</PwaAppPageLayout>
	);
}
