import Button, { type ButtonProps } from "@libs/components/atoms/Button";
import CircularProgress from "@libs/components/atoms/CircularProgress";

export interface Props extends ButtonProps {
	isLoading?: boolean;
	disabled?: boolean;
}

export default function LoadingButton({
	children,
	isLoading,
	disabled,
	...restProps
}: Readonly<Props>) {
	const endIcon = isLoading ? <CircularProgress size={14} /> : undefined;

	// Disabled while loading whatever `disabled` says, so a pending request cannot be sent twice.
	return (
		<Button disabled={isLoading || disabled} endIcon={endIcon} {...restProps}>
			{children}
		</Button>
	);
}
