import Box, { type BoxProps } from "@libs/components/atoms/Box";

interface ImageProps {
	src: string;
	alt?: string;
	sx?: BoxProps["sx"];
	width?: BoxProps["width"];
	height?: BoxProps["height"];
	maxWidth?: BoxProps["maxWidth"];
	onClick?: BoxProps["onClick"];
	// For an image used as a control (e.g. a choice in a form).
	role?: string;
	tabIndex?: number;
	"aria-label"?: string;
	"aria-checked"?: boolean;
	onKeyDown?: BoxProps["onKeyDown"];
}

export default function ImageBox({
	alt,
	src,
	sx = {},
	width = "auto",
	height = "auto",
	maxWidth,
	onClick,
	...control
}: Readonly<ImageProps>) {
	return (
		<Box
			component="img"
			{...{ height, maxWidth, width, sx, alt, src, onClick }}
			{...control}
		/>
	);
}
