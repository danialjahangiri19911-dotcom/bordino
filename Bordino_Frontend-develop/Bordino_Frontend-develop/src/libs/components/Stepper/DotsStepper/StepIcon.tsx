import React from "react";

import Box from "@libs/components/atoms/Box";

interface Props {
	active: boolean;
}

export default function StepIcon({ active }: Readonly<Props>) {
	return (
		<Box
			sx={{
				width: 10,
				height: 10,
				borderRadius: "50%",
				backgroundColor: active ? "info.dark" : "grey.300",
				margin: (theme) => theme.spacing(0, 1 / 2),
			}}
		/>
	);
}
