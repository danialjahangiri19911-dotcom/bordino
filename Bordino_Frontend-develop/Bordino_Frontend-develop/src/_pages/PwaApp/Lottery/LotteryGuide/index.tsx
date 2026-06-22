"use client";

import { useRouter } from "next/navigation";

import GuideContent from "./GuideContent";
import Back from "@libs/components/layouts/PwaAppLayout/customRightActions/Back";
import PwaAppPageLayout from "@libs/components/layouts/PwaAppLayout";

export default function LotteryGuide() {
	const { back } = useRouter();

	return (
		<PwaAppPageLayout sx={{ mx: 0 }} rightAction={<Back handleBack={() => back()} />}>
			<GuideContent />
		</PwaAppPageLayout>
	);
}
