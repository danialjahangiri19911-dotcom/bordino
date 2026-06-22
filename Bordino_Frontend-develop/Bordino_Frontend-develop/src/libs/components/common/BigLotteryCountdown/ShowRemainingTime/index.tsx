import React, { Fragment, memo } from "react";

import useShowRemainingTime from "./useShowRemainingTime";
import type { BoxProps } from "@libs/components/atoms/Box";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

interface Props {
	seconds: number;
	sx?: BoxProps["sx"];
	inputSx?: BoxProps["sx"];
}

function ShowRemainingTime({ seconds, sx, inputSx }: Readonly<Props>) {
	const formatTime = useShowRemainingTime({ seconds });

	return (
		<Wrapper sx={sx}>
			{Object.entries(formatTime).map(([key, value], index, arr) => (
				<Fragment key={key}>
					<ItemWrapper>
						<ItemInput sx={inputSx}>{value}</ItemInput>
						<Typography variant="11-regular">{key}</Typography>
					</ItemWrapper>
					{index < arr.length - 1 && (
						<Typography mt={1} variant="14-regular">
							:
						</Typography>
					)}
				</Fragment>
			))}
		</Wrapper>
	);
}

export default memo(ShowRemainingTime);

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	gap: theme.spacing(0.5),
	alignItems: "start",
	flexDirection: "row-reverse",
}));

const ItemWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(0.5),
	alignItems: "center",
}));

const ItemInput = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "center",
	alignItems: "center",
	gap: theme.spacing(0.5),
	padding: theme.spacing(0.5),
	borderRadius: theme.shape.borderRadius,
	border: `1px solid ${theme.palette.primary[100]}`,
	backgroundColor: theme.palette.common.white,
}));
