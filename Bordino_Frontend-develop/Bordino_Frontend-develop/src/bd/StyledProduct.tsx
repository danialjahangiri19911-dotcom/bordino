"use client";

import type { ReactNode } from "react";

import { styleClass, useBdStyle } from "./appearance";

/** A design surface (.bd-product) in the player's chosen style, for pages rendered on the server. */
export default function StyledProduct({ className, label, children }: { className: string; label: string; children: ReactNode }) {
	return (
		<article className={`bd-product ${styleClass(useBdStyle())} ${className}`} aria-label={label}>
			{children}
		</article>
	);
}
