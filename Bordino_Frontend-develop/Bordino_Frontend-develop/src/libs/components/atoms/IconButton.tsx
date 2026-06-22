import MuiIconButton, { type IconButtonProps } from "@mui/material/IconButton";

export default function IconButton({ sx = {}, ...rest }: IconButtonProps) {
	return <MuiIconButton {...rest} sx={{ p: 0, ...sx }} />;
}

export { type IconButtonProps };
