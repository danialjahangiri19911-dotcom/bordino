import React from "react";
import type { FieldValues } from "react-hook-form";

import { CUSTOM_ADAPTER_LOCALE } from "./constants";
import { type DatePickerProps } from "./interfaces";
import useDatePicker from "./useDatePicker";
import {
	AdapterDateFnsJalali,
	DatePicker as BaseDatePicker,
	LocalizationProvider,
} from "@libs/components/atoms/DatePicker";

export default function DatePicker<T extends FieldValues>({
	label,
	...restProps
}: Readonly<DatePickerProps<T>>) {
	const { datePickerProps } = useDatePicker({ ...restProps });

	return (
		<LocalizationProvider
			dateAdapter={AdapterDateFnsJalali}
			adapterLocale={CUSTOM_ADAPTER_LOCALE}
		>
			<BaseDatePicker {...datePickerProps} label={label} />
		</LocalizationProvider>
	);
}
