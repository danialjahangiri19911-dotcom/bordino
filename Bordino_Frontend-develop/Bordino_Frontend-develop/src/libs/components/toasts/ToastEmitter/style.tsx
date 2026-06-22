import { Global, css } from "@emotion/react";

export function ToastEmitterStyles() {
	return (
		<Global
			styles={css`
				.custom-toast {
					width: auto !important;
					max-width: 600px !important;
				}

				.Toastify__toast-body {
					margin-bottom: 0 !important;
				}

				.Toastify__toast {
					margin-bottom: 0 !important;
					padding: 7px;
				}
			`}
		/>
	);
}
