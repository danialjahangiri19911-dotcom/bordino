import type { FieldValues } from "react-hook-form";

import type { DatePickerProps as DatePickerBaseProps } from "@libs/components/atoms/DatePicker";

import type { FieldBaseProps } from "@/libs/components/fields/interfaces";

export interface DatePickerProps<T extends FieldValues>
	extends Omit<DatePickerBaseProps, "onChange" | "name">, FieldBaseProps<T> {
	label?: string;
	onOpen?: () => void;
	onClose?: () => void;
	minDate?: Date;
	placeholder?: string;
	onChange?: (newValue: string) => void;
	clearable?: boolean;
	hasEndAdornmentDefaultIcon?: boolean;
}
