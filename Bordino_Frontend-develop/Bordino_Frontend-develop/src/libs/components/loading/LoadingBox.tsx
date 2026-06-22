import type { ReactNode } from "react";

import Box from "@libs/components/atoms/Box";
import CircularProgress from "@libs/components/atoms/CircularProgress";
import type { SxProps } from "@libs/styles/styled";

interface Props {
	isLoading?: boolean;
	children: ReactNode;
	sx?: SxProps;
	iconSx?: SxProps;
}

export default function LoadingBox({
	isLoading,
	children,
	sx,
	iconSx,
}: Readonly<Props>) {
	if (isLoading) {
		return (
			<Box position="relative" sx={sx}>
				<Box
					sx={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -40%)",
						zIndex: 1,
					}}
				>
					<CircularProgress sx={iconSx} />
				</Box>
				<Box
					sx={{
						opacity: 0.3,
						transition: "opacity 0.3s ease",
						pointerEvents: "none",
					}}
				>
					{children}
				</Box>
			</Box>
		);
	}
	return <Box>{children}</Box>;
}
