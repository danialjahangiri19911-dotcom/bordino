import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import InputAdornment from "@libs/components/atoms/InputAdornment";
import { type Theme } from "@libs/styles/styled";

export interface CounterProps<F extends FieldValues> {
	form: UseFormReturn<F>;
	name: Path<F>;
	length: number;
}

const sx = (theme: Theme) => ({
	position: "absolute",
	top: 0,
	transform: "translateY(-50%)",
	background: theme.palette.common.white,
	right: 25,
	height: "max-content",
	width: "max-content",
	zIndex: 1,
	paddingX: 0.5,
	fontSize: theme.typography.fontSize,
});

export default function Counter<F extends FieldValues>(
	props: Readonly<CounterProps<F>>,
) {
	const { form, name, length } = props;
	const { watch } = form;
	const value = watch(name);
	return (
		<InputAdornment sx={sx} position="end">
			{value?.length ?? 0}/{length}
		</InputAdornment>
	);
}
