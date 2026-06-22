"use client";

import type { ReactNode } from "react";
import { memo } from "react";

import Box from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

import Navbar from "@/libs/components/landing/Navbar";
import { useDevice } from "@/libs/uiHooks/device";

interface Props {
	children: ReactNode;
}

function LandingLayout({ children }: Readonly<Props>) {
	const { isTablet } = useDevice();
	return (
		<Box
			display="flex"
			flexDirection="column"
			minHeight="100svh"
			sx={{ overflowX: "hidden" }}
		>
			<Navbar />
			<Box component="main" flexGrow={1}>
				<PageWrapper isTablet={isTablet}>{children}</PageWrapper>
			</Box>
		</Box>
	);
}

const PageWrapper = styled(Box, {
	shouldForwardProp: (prop) => prop !== "isTablet",
})<{ isTablet: boolean }>(({ theme }) => ({
	// maxWidth: 1440,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	// margin: 'auto',
	// marginBlock: isTablet ? theme.spacing(4) : theme.spacing(8),
	// width: '90%',

	[theme.breakpoints.up("xs")]: {
		paddingTop: 80,
	},
	[theme.breakpoints.up("lg")]: {
		paddingTop: 104,
	},
}));

export default memo(LandingLayout);
