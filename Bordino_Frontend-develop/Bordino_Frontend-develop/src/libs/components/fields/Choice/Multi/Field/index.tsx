import { memo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";

import Box from "@libs/components/atoms/Box";
import Checkbox from "@libs/components/atoms/Checkbox";
import { FormGroup } from "@libs/components/atoms/FormGroup";
import Typography from "@libs/components/atoms/Typography";
import type { MultiChoiceProps } from "@libs/components/fields/Choice/interfaces";
import { ItemWrapper } from "@libs/components/fields/Choice/styledComponents";
import useFieldError from "@libs/components/fields/useFieldError";

import ImageBox from "@/libs/components/ImageBox";

function MultiChoiceFields<V extends FieldValues>({
	form,
	name,
	options,
	label,
}: Readonly<MultiChoiceProps<V>>) {
	const {
		field: { value = [] as string[], onChange },
	} = useController({
		name,
		control: form.control,
	});

	const handleCheckboxChange = useCallback(
		(optionValue: string | number) => {
			const newValues = value.includes(optionValue as string)
				? value.filter((v: string) => v !== optionValue)
				: [...value, optionValue];

			onChange(newValues);
		},
		[value, onChange],
	);

	const { errorMessage, hasError } = useFieldError(form, name);

	return (
		<Box display="flex" flexDirection="column" gap={2} mb={2}>
			{label && <Typography>{label}</Typography>}
			<FormGroup sx={{ gap: 2 }}>
				{options.map((option) => (
					<ItemWrapper key={option.value}>
						<Box display="flex" gap={1} alignItems="center">
							{option.icon && <ImageBox src={option.icon} />}
							<Typography variant="14-regular">{option.label}</Typography>
						</Box>
						<Checkbox
							checked={value.includes(option.value)}
							onChange={() => handleCheckboxChange(option.value)}
							color="secondary"
						/>
					</ItemWrapper>
				))}
			</FormGroup>
			{hasError && (
				<Typography color="error" variant="14-regular">
					{errorMessage}
				</Typography>
			)}
		</Box>
	);
}

export default memo(MultiChoiceFields) as typeof MultiChoiceFields;
