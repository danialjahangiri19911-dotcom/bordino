import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";

import CustomActionBar from "./CustomActionBar";
import useDatePickerStyles from "./datePickerStyles";
import type { DatePickerProps } from "./interfaces";
import type {
	DatePickerProps as BaseDatepickerProps,
	DateView,
} from "@libs/components/atoms/DatePicker";
import IconButton from "@libs/components/atoms/IconButton";
import type { TextFieldProps } from "@libs/components/atoms/TextField";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import moment from "moment-jalaali";

import useFieldError from "@/libs/components/fields/useFieldError";
import { moment2String, string2Moment } from "@/libs/utils/date";

type Props<T extends FieldValues> = Omit<DatePickerProps<T>, "label">;

export default function useDatePicker<T extends FieldValues>({
	onChange,
	minDate,
	onClose,
	onOpen,
	placeholder,
	clearable = true,
	hasEndAdornmentDefaultIcon = true,
	form,
	name,
	...restProps
}: Props<T>) {
	const [open, setOpen] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const { dayStyles, layoutStyles, calendarHeaderStyles } =
		useDatePickerStyles();
	const { errorMessage, hasError } = useFieldError(form, name);

	const controller = useController({
		name,
		control: form.control,
	});

	useEffect(() => {
		if (controller?.field.value) {
			const parsedDate = string2Moment(
				controller.field.value,
				false,
				false,
				"/",
			).toDate();
			setSelectedDate(parsedDate);
		} else {
			setSelectedDate(null);
		}
	}, [controller, controller.field.value]);

	const inputValue = useMemo(() => {
		return selectedDate
			? moment2String(moment(selectedDate), true, false, "/")
			: (placeholder ?? "روز / ماه / سال");
	}, [placeholder, selectedDate]);

	const handleChange = useCallback(
		(newValue: Date | null) => {
			setSelectedDate(newValue);
			if (newValue) {
				const formattedDate = moment2String(
					moment(newValue),
					false,
					false,
					"-",
				);

				if (onChange) {
					onChange(formattedDate);
				}
				if (controller) {
					controller.field.onChange(formattedDate);
				}
			} else {
				if (onChange) {
					onChange("");
				}
				if (controller) {
					controller.field.onChange("");
				}
			}
		},
		[onChange, controller],
	);

	const handleOpen = useCallback(() => {
		setOpen(true);
		if (onOpen) {
			onOpen();
		}
	}, [onOpen]);

	const handleClose = useCallback(() => {
		setOpen(false);
		if (onClose) {
			onClose();
		}
	}, [onClose]);

	const datePickerProps: BaseDatepickerProps = useMemo(() => {
		return {
			value: selectedDate,
			onChange: handleChange,
			open,
			onClose: handleClose,
			onOpen: handleOpen,
			views: ["month", "year", "day"] as DateView[],
			slotProps: {
				field: { clearable },
				textField: {
					size: "medium" as TextFieldProps["size"],
					error: hasError,
					helperText: hasError && errorMessage,
					InputProps: {
						startAdornment: hasEndAdornmentDefaultIcon ? (
							<IconButton
								onClick={() => setOpen(!open)}
								sx={{
									mr: 1,
								}}
							>
								<CalendarMonthOutlinedIcon />
							</IconButton>
						) : null,
					},
					inputProps: {
						onClick: () => setOpen(true),
						value: inputValue,
					},
					fullWidth: true,
				},
				calendarHeader: {
					sx: calendarHeaderStyles,
				},
				day: {
					sx: dayStyles,
				},
				layout: {
					sx: layoutStyles,
				},
			},
			slots: {
				actionBar: CustomActionBar,
			},
			localeText: {
				toolbarTitle: "انتخاب زمان",
			},
			minDate,
			...restProps,
		};
	}, [
		calendarHeaderStyles,
		clearable,
		dayStyles,
		errorMessage,
		handleChange,
		handleClose,
		handleOpen,
		hasEndAdornmentDefaultIcon,
		hasError,
		inputValue,
		layoutStyles,
		minDate,
		open,
		restProps,
		selectedDate,
	]);

	return { datePickerProps };
}
