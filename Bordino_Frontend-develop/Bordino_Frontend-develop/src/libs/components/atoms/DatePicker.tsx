import {
	type DatePickerProps as BaseDatePickerProps,
	DatePicker,
	type PickersActionBarAction,
	type PickersActionBarProps,
} from "@mui/x-date-pickers";
import { AdapterDateFnsJalali } from "@mui/x-date-pickers/AdapterDateFnsJalaliV3";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import type { DateView } from "@mui/x-date-pickers/models/views";

export type DatePickerProps = BaseDatePickerProps<Date>;

export {
	LocalizationProvider,
	AdapterDateFnsJalali,
	AdapterDateFns,
	DateTimePicker,
	DatePicker,
	DateView,
	PickersActionBarAction,
	PickersActionBarProps,
};
