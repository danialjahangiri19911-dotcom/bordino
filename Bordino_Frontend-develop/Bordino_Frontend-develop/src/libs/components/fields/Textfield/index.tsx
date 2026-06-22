import type { ChangeEvent } from "react";
import { useCallback } from "react";
import {
	Controller,
	type ControllerRenderProps,
	type FieldValues,
	type Path,
} from "react-hook-form";

import Counter from "./Counter";
import { type FieldBaseProps } from "@libs/components/fields/interfaces";
import useFieldError from "@libs/components/fields/useFieldError";

import type {
	InputLabelProps,
	InputProps,
} from "@/libs/components/atoms/Input";
import MuiTextField, {
	type TextFieldProps as MuiTextFieldProps,
} from "@/libs/components/atoms/TextField";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

interface MultilineProps {
	maxRows: number;
	minRows?: number;
}

export interface TextFieldProps<
	V extends FieldValues,
> extends FieldBaseProps<V> {
	required?: boolean;
	inputType?: "number" | "string";
	maxLen?: number;
	name: Path<V>;
	InputProps?: InputProps;
	multilineProps?: Partial<MultilineProps>;
	labelProps?: InputLabelProps;
	onChange?: MuiTextFieldProps["onChange"];
	placeholder?: string;
	disable?: boolean;
	sx?: MuiTextFieldProps["sx"];
	minLen?: number;
}

export default function TextField<V extends FieldValues>(
	props: Readonly<TextFieldProps<V>>,
) {
	const {
		form,
		name,
		label,
		required,
		placeholder,
		inputType = "string",
		maxLen,
		multilineProps,
		onChange,
		InputProps,
		labelProps,
		disable,
		sx,
		minLen,
	} = props;

	const { hasError, errorMessage } = useFieldError(form, name);

	const handleChange = useCallback(
		(
			e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
			field: ControllerRenderProps<V, Path<V>>,
		) => {
			const value = e.target.value;
			if ((maxLen && value.length <= maxLen) || !maxLen) {
				if (inputType === "number") {
					const numberValue = persianNumberConverter(value);

					if (Number(numberValue) || !value) {
						field.onChange(numberValue);
					}
				} else {
					field.onChange(e);
				}

				if (onChange) {
					onChange(e);
				}
			}
		},
		[inputType, maxLen, onChange],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			const invalidKeys = ["e", "E", "+", "-", "."];

			if (inputType === "number" && invalidKeys.includes(event.key)) {
				event.preventDefault();
			}
		},
		[inputType],
	);

	return (
		<Controller
			name={name}
			control={form.control}
			render={({ field }) => {
				const hasValue = Boolean(field.value);
				return (
					<MuiTextField
						helperText={errorMessage}
						error={hasError}
						label={label}
						onChange={(e) => handleChange(e, field)}
						sx={{
							"& .MuiOutlinedInput-root": {
								borderRadius: "12px",
								"& fieldset": {
									border: "1px solid #ADADAD",
								},
								"&:hover fieldset": {
									border: "1px solid #ADADAD",
								},
								"&.Mui-focused fieldset": {
									border: hasValue ? "1px solid #1F2937" : "1px solid #1F2937",
								},
								"&.Mui-error fieldset": {
									border: "1px solid #E64056",
								},
								"&.Mui-error.Mui-focused fieldset": {
									border: "1px solid #E64056",
								},
								...(hasValue && !hasError
									? {
											"& fieldset": {
												border: "1px solid #1F2937",
											},
										}
									: {}),
							},
							...sx,
						}}
						disabled={disable}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						required={required}
						multiline={Boolean(multilineProps)}
						maxRows={multilineProps?.maxRows}
						minRows={multilineProps?.minRows ?? 4}
						slotProps={{
							inputLabel: {
								...labelProps,
								shrink: hasValue,
							},
							input: {
								readOnly: disable,
								...(InputProps || {}),
								startAdornment: InputProps?.startAdornment,
								endAdornment: minLen ? (
									<Counter {...{ form, name, length: minLen }} />
								) : (
									InputProps?.endAdornment
								),
							},
							htmlInput: {
								...form.register(name),
								...(maxLen ? { maxLength: maxLen } : {}),
							},
						}}
						fullWidth
					/>
				);
			}}
		/>
	);
}
