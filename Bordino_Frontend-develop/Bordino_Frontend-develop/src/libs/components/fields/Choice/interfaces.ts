import type { FieldValues } from "react-hook-form";

import type { FieldBaseProps } from "@libs/components/fields/interfaces";

interface BaseChoiceType {
	label: string;
	value: string;
}

interface SingleChoiceOption extends BaseChoiceType {
	score: number;
}

export interface SingleChoiceProps<
	V extends FieldValues,
> extends FieldBaseProps<V> {
	options: SingleChoiceOption[];
}

interface MultiChoiceOption extends BaseChoiceType {
	icon?: string;
}

export interface MultiChoiceProps<
	V extends FieldValues,
> extends FieldBaseProps<V> {
	options: MultiChoiceOption[];
}

export interface MultiPictureChoiceProps<V extends FieldValues> extends Omit<
	FieldBaseProps<V>,
	"label"
> {
	options: { value: string; icon: string; color?: string }[];
}
