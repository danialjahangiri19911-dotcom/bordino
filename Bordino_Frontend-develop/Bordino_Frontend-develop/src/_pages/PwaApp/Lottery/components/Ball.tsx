import React from "react";

import Box, { type BoxProps } from "@/libs/components/atoms/Box";
import styled from "@/libs/styles/styled";

interface Props {
	num: number;
	ballBackgroundColor?: BoxProps["bgcolor"];
	sx?: BoxProps["sx"];
	ballInnerSx?: BoxProps["sx"];
}

export default function BallComponent({
	num,
	ballBackgroundColor = "#FFC43B",
	sx,
	ballInnerSx,
}: Readonly<Props>) {
	return (
		<Ball sx={{ backgroundColor: ballBackgroundColor, ...sx }}>
			<BallInner sx={ballInnerSx}>{num}</BallInner>
		</Ball>
	);
}

const Ball = styled(Box)({
	borderRadius: "50%",
	width: 48,
	height: 48,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	border: "2px solid #222",
	position: "relative",
	boxSizing: "border-box",
	boxShadow: "0 2px 6px #0002",
});

const BallInner = styled(Box)({
	background: "#fff",
	borderRadius: "50%",
	width: 25,
	height: 25,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontWeight: 700,
	fontSize: 18,
	color: "#222",
	position: "absolute",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	boxShadow: "0 1px 2px #0001",
});
