import Button, { type ButtonProps } from "@libs/components/atoms/Button";
import CircularProgress from "@libs/components/atoms/CircularProgress";

export interface Props extends ButtonProps {
	isLoading?: boolean;
}

export default function LoadingButton({
	children,
	isLoading,
	...restProps
}: Readonly<Props>) {
	const endIcon = isLoading ? <CircularProgress size={14} /> : undefined;

	return (
		<Button disabled={isLoading} endIcon={endIcon} {...restProps}>
			{children}
		</Button>
	);
}
