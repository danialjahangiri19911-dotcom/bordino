import Box from "@libs/components/atoms/Box";
import CircularProgress from "@libs/components/atoms/CircularProgress";

export default function PageLoading() {
	return (
		<Box
			display="flex"
			justifyContent="center"
			alignItems="center"
			width="100%"
			height="100vh"
		>
			<CircularProgress />
		</Box>
	);
}
