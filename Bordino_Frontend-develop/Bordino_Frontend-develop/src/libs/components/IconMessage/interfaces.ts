import type { ReactElement } from "react";

export type IconType = string | ReactElement | undefined;

export interface BaseIconMessageProps {
	firstIcon?: IconType;
	lastIcon?: IconType;
	backgroundColor?: string;
	messagePrefix: string;
	message: string | number;
	color?: string;
}
