import type { ChangeEvent } from "react";
import type { FieldValues, Path, PathValue } from "react-hook-form";
import "react-hook-form";

import Box from "@libs/components/atoms/Box";
import BaseCheckbox from "@libs/components/atoms/Checkbox";
import {
	FormControl,
	FormControlLabel,
	FormHelperText,
} from "@libs/components/atoms/FormControl";
import Typography from "@libs/components/atoms/Typography";
import type { FieldBaseProps } from "@libs/components/fields/interfaces";
import useFieldError from "@libs/components/fields/useFieldError";
import styled from "@libs/styles/styled";

interface Props<V extends FieldValues> extends FieldBaseProps<V> {
	required?: boolean;
	disabled?: boolean;
	onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function Checkbox<V extends FieldValues>(
	props: Readonly<Props<V>>,
) {
	const { form, label, name, required, disabled, onChange } = props;
	const { hasError, errorMessage } = useFieldError(form, name);

	const checked = !!form.watch(name);

	return (
		<FormControl error={hasError} sx={{ width: "100%" }}>
			<Box display="flex">
				<CustomFormControlLabel
					required={required}
					sx={{ display: "flex", alignItems: "center" }}
					control={
						<BaseCheckbox
							sx={{ pl: "0 !important" }}
							checked={checked}
							onChange={(e) => {
								form.setValue(name, e.target.checked as PathValue<V, Path<V>>);
								if (onChange) onChange(e);
							}}
						/>
					}
					label={label}
					disabled={disabled}
				/>
			</Box>
			{hasError && (
				<FormHelperText>
					<Typography>{errorMessage}</Typography>
				</FormHelperText>
			)}
		</FormControl>
	);
}

const CustomFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
	"&.MuiFormControlLabel-root": {
		alignItems: "flex-start",
		margin: 0,
		marginRight: 2,
	},
	"& .MuiFormControlLabel-asterisk": {
		color: theme.palette.error.main,
	},
	"& .MuiCheckbox-sizeMedium": {
		paddingTop: 0,
	},
}));
