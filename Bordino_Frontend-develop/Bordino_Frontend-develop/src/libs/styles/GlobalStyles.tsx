import { Global, css } from "@emotion/react";

export function GlobalStyles() {
	return (
		<Global
			styles={css`
				body {
					margin: 0;
				}

				::-webkit-scrollbar {
					width: 6px;
					height: 6px;
					border-radius: 8px;
				}

				::-webkit-scrollbar-track {
					background: #f3f4f6;
				}

				::-webkit-scrollbar-thumb {
					background: #d1d5db;
					border-radius: 8px;
				}

				::-webkit-scrollbar-thumb:hover {
					background: #aaadb3;
				}
			`}
		/>
	);
}
