import type { ReactElement } from "react";
import { cloneElement } from "react";

import { SvgIcon } from "@libs/components/atoms/SvgIcon";
import type { BaseSvgInterfaces } from "@libs/components/icons/interfaces";

export function IconWrapper({
	strokeColor = "currentColor",
	children,
	...props
}: Readonly<BaseSvgInterfaces>) {
	return (
		<SvgIcon {...props}>
			{cloneElement(children as ReactElement, {
				stroke: strokeColor,
			})}
		</SvgIcon>
	);
}
