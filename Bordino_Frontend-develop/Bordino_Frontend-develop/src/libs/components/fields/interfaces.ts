import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

export interface FieldBaseProps<V extends FieldValues> {
	name: Path<V>;
	form: UseFormReturn<V>;
	label?: string;
}
