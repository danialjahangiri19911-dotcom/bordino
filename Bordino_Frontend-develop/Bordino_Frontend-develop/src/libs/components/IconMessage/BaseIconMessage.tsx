import { isValidElement, memo, useCallback } from "react";

import type { BaseIconMessageProps, IconType } from "./interfaces";
import ImageBox from "@libs/components/ImageBox";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";

function BaseIconMessage({
	message,
	messagePrefix,
	backgroundColor,
	firstIcon,
	lastIcon,
	color,
}: Readonly<BaseIconMessageProps>) {
	const renderIcon = useCallback((icon: IconType) => {
		if (isValidElement(icon) || (typeof icon === "string" && icon.length < 5)) {
			return icon;
		}
		if (typeof icon === "string" && icon.length > 5) {
			return <ImageBox src={icon} alt="icon" width={18} height={18} />;
		}

		return null;
	}, []);

	return (
		<Box
			color={color}
			sx={{ backgroundColor }}
			padding={(theme) => theme.spacing(1 / 2, 1)}
			borderRadius={3}
			display="flex"
			alignItems="center"
			gap={1}
			width="max-content"
		>
			{renderIcon(firstIcon)}
			<Typography variant="12-regular">
				{message} {messagePrefix}
			</Typography>
			{renderIcon(lastIcon)}
		</Box>
	);
}

export default memo(BaseIconMessage);
