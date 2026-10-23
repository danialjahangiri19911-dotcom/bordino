"use client";

import { useRouter } from "next/navigation";

import GuideContent from "@/_pages/PwaApp/Lottery/LotteryGuide/GuideContent";
import Back from "@libs/components/layouts/PwaAppLayout/customRightActions/Back";

// «شرایط و قوانین» (linked from sign-up): until the official terms text is published, this page shows
// the lottery guide, which holds the actual rules of the game (tickets, prizes, how the draw works).
export default function RulesPage() {
	const { back } = useRouter();
	return (
		<div style={{ padding: "16px 0 32px" }}>
			<div style={{ padding: "0 16px" }}>
				<Back handleBack={() => back()} />
			</div>
			<GuideContent />
		</div>
	);
}
