import React from "react";

import PwaAppLayout from "@/libs/components/layouts/PwaAppLayout";

export default function Game2048Layout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <PwaAppLayout>{children}</PwaAppLayout>;
}
