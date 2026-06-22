import type { ReactNode } from "react";

import Box from "@libs/components/atoms/Box";
import type { SxProps } from "@libs/styles/styled";

interface TabPanelProps {
	children: ReactNode;
	index: number;
	value: number;
	sx?: SxProps;
}

export default function TabPanel(props: Readonly<TabPanelProps>) {
	const { children, value, index, sx, ...restProps } = props;
	return (
		<Box role="tabpanel" hidden={value !== index} {...restProps}>
			{value === index && <Box sx={sx}>{children}</Box>}
		</Box>
	);
}
