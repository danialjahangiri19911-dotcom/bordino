import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Typography from "@libs/components/atoms/Typography";

interface Props {
	/** Shown while loading; a failure shows `errorText` and a retry instead of a blank page. */
	loading?: boolean;
	error?: unknown;
	onRetry?: () => void;
	errorText?: string;
}

/** What a page shows while its data loads or after the request failed (null once loaded). */
export default function LoadState({
	loading,
	error,
	onRetry,
	errorText = "بارگذاری نشد. اتصال را بررسی کنید.",
}: Readonly<Props>) {
	if (error) {
		return (
			<Box display="flex" flexDirection="column" alignItems="center" gap={1.5} sx={{ py: 6 }} role="alert">
				<Typography variant="14-medium" color="text.secondary" textAlign="center">
					{errorText}
				</Typography>
				{onRetry && (
					<Button variant="outlined" size="small" onClick={onRetry}>
						دوباره تلاش کن
					</Button>
				)}
			</Box>
		);
	}
	if (loading) {
		return (
			<Typography color="text.secondary" textAlign="center" sx={{ py: 6, fontSize: 13 }}>
				در حال بارگذاری…
			</Typography>
		);
	}
	return null;
}
