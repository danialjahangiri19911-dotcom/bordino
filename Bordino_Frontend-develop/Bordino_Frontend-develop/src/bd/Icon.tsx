import { createElement } from "react";

import { ICONS, type IconName } from "./icons";

interface Props {
	name: IconName;
	size?: number;
	className?: string;
	/** Read aloud only when the icon is the whole label (an icon-only control already has aria-label). */
	label?: string;
}

/** A Lucide 1.17.0 icon (the design's pinned set), inline so it inherits colour and needs no request. */
export default function Icon({ name, size, className, label }: Readonly<Props>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			{...(size ? { width: size, height: size, style: { width: size, height: size } } : {})}
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
		>
			{ICONS[name].map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
		</svg>
	);
}

export type { IconName };
