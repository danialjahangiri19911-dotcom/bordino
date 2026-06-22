import type { ReactNode } from "react";

import Box from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

interface Props {
	children: ReactNode;
}

export default function PwaOnBoardingPageLayout({ children }: Readonly<Props>) {
	return <Wrapper>{children}</Wrapper>;
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	paddingInline: theme.spacing(2),
	height: "100vh",
	justifyContent: "space-evenly",
	alignItems: "center",
	backgroundColor: "#E9EEF3",
}));
