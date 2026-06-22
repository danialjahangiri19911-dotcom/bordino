import Box from "@mui/material/Box";

import { containerWidthDesktop, containerWidthMobile } from "@/constants/2048";

export default function LoadingSkeleton() {
	return (
		<Box
			sx={{
				width: { xs: containerWidthMobile, sm: containerWidthDesktop },
				height: { xs: containerWidthMobile, sm: containerWidthDesktop },
				backgroundColor: "rgba(0,0,0,0.05)",
				borderRadius: 2,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Box sx={{ color: "text.secondary" }}>Loading game...</Box>
		</Box>
	);
}
