import { type SyntheticEvent } from "react";

import Alert from "@libs/components/atoms/Alert";
import type { AlertColor } from "@libs/components/atoms/Alert";
import MuiSnackbar, { type SnackbarProps } from "@mui/material/Snackbar";

export { type SnackbarProps };

export interface Props {
	open: boolean;
	message: string;
	onClose: (event?: SyntheticEvent | Event, reason?: string) => void;
	anchorOrigin?: SnackbarProps["anchorOrigin"];
	severity?: AlertColor;
}

export default function Snackbar({
	open,
	severity = "success",
	message,
	onClose,
	anchorOrigin = { vertical: "top", horizontal: "center" },
}: Readonly<Props>) {
	return (
		<MuiSnackbar
			open={open}
			autoHideDuration={3000}
			onClose={onClose}
			anchorOrigin={anchorOrigin}
		>
			<Alert
				onClose={onClose}
				severity={severity}
				variant="filled"
				sx={{ width: "100%" }}
			>
				{message}
			</Alert>
		</MuiSnackbar>
	);
}
