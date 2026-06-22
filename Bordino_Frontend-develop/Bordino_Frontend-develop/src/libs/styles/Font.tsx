import { useMemo } from "react";

import { Global, css } from "@emotion/react";

export function Fonts() {
	const fontFaces = useMemo(
		() => [
			{
				fontWeight: "bold",
				files: {
					ttf: "/fonts/bold.ttf",
				},
			},
			{
				fontWeight: 500,
				files: {
					ttf: "/fonts/medium.ttf",
				},
			},
			{
				fontWeight: "normal",
				files: {
					ttf: "/fonts/regular.ttf",
				},
			},
		],
		[],
	);
	return (
		<Global
			styles={css`
				${fontFaces.map(
					(font) =>
						`
          @font-face {
            font-family: 'shabnam';
            font-style: normal;
            font-weight: ${font.fontWeight};
            src: 
                 url(${font.files.ttf}) format('truetype')
          }
                
        `,
				)}
				* {
					font-family: "shabnam", sans-serif;
				}
			`}
		/>
	);
}
