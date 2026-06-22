import { useMemo } from "react";
import type { FieldValues } from "react-hook-form";

import type { FieldBaseProps } from "./interfaces";
import _ from "lodash";

export default function useFieldError<V extends FieldValues>(
	form: FieldBaseProps<V>["form"],
	name: FieldBaseProps<V>["name"],
) {
	const { formState } = form;
	const errorMessage = useMemo(() => {
		return (_.get(formState.errors, `${name}.message`) ?? "") as string;
	}, [name, formState]);

	return {
		hasError: Boolean(errorMessage),
		errorMessage,
	};
}
