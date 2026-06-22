import React from "react";

import { Circle, CircleBg, CircularPathD, CircularSvg } from "./styles";

export function CircularProgress({ percent }: { percent: number }) {
	return (
		<CircularSvg viewBox="0 0 36 36">
			<CircleBg d={CircularPathD} />
			<Circle d={CircularPathD} strokeDasharray={`${percent * 100}, 100`} />
		</CircularSvg>
	);
}
