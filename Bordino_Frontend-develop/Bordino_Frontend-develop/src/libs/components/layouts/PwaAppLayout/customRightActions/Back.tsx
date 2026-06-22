import React from "react";

import Image from "next/image";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";

interface Props {
	handleBack: () => void;
}

export default function Back({ handleBack }: Props) {
	return (
		<Box
			display="flex"
			alignItems="center"
			gap={0.5}
			sx={{ cursor: "pointer" }}
			onClick={handleBack}
		>
			<Image
				quality={100}
				alt="back"
				src="/media/App/chevron-back.svg"
				height={16}
				width={16}
			/>
			<Typography variant="16-medium">بازگشت</Typography>
		</Box>
	);
}
