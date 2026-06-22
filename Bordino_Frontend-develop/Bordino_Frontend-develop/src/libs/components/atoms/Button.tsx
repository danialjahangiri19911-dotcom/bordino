import MuiButton, { type ButtonProps } from "@mui/material/Button";

export type { ButtonProps };

export default function Button({
	variant = "contained",
	...restProps
}: Readonly<ButtonProps>) {
	return <MuiButton variant={variant} {...restProps} />;
}
