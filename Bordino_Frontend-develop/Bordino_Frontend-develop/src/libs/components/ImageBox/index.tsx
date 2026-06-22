import Box, { type BoxProps } from "@libs/components/atoms/Box";

interface ImageProps {
	src: string;
	alt?: string;
	sx?: BoxProps["sx"];
	width?: BoxProps["width"];
	height?: BoxProps["height"];
	maxWidth?: BoxProps["maxWidth"];
	onClick?: BoxProps["onClick"];
}

export default function ImageBox({
	alt,
	src,
	sx = {},
	width = "auto",
	height = "auto",
	maxWidth,
	onClick,
}: Readonly<ImageProps>) {
	return (
		<Box
			component="img"
			{...{ height, maxWidth, width, sx, alt, src, onClick }}
		/>
	);
}
