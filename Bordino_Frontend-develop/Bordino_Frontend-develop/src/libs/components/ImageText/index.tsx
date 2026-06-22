import type { ReactNode } from "react";

import ImageBox from "@libs/components/ImageBox";
import Box, { type BoxProps } from "@libs/components/atoms/Box";
import Typography, {
	type TypographyProps,
} from "@libs/components/atoms/Typography";
import styled, { type SxProps } from "@libs/styles/styled";

interface Props {
	title?: string;
	content: ReactNode;
	src: string;
	sx?: SxProps;
	imageSx?: BoxProps["sx"];
	titleProps?: TypographyProps;
	mainContentProps?: BoxProps["sx"];
}

export default function ImageText({
	src,
	content,
	imageSx,
	mainContentProps,
	sx,
	title,
	titleProps,
}: Readonly<Props>) {
	return (
		<Wrapper sx={sx}>
			<BoxWrapper>
				<Typography {...titleProps}>{title}</Typography>
				<ContentBox sx={mainContentProps}>{content}</ContentBox>
			</BoxWrapper>
			<ImageWrapper>
				<ImageBox alt="image" sx={imageSx} src={src} />
			</ImageWrapper>
		</Wrapper>
	);
}

const BoxWrapper = styled(Box)(({ theme }) => ({
	width: "fit-content",
	display: "flex",
	flexDirection: "column",
	[theme.breakpoints.down("md")]: {
		alignItems: "center",
		textAlign: "center",
	},
	justifyContent: "center",
	gap: theme.spacing(2),
}));
const ContentBox = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	[theme.breakpoints.down("md")]: {
		alignItems: "center",
		textAlign: "center",
	},
	gap: theme.spacing(2),
}));

const ImageWrapper = styled(Box)(() => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
}));

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	[theme.breakpoints.down("md")]: {
		flexDirection: "column-reverse",
	},
}));
