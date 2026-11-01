"use client";

import { Suspense } from "react";

import WheelGame from "../wheel/WheelGame";

/** «گردونه» (the Bordino-Wheel-Game-Design look); the game itself is in wheel/WheelGame. */
export default function Wheel() {
	return (
		<Suspense>
			<WheelGame />
		</Suspense>
	);
}
