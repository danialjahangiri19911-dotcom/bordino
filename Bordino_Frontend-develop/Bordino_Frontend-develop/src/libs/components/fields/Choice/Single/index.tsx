import React, { memo } from "react";
import type { FieldValues, Path, PathValue } from "react-hook-form";
import { useController } from "react-hook-form";

import Box from "@libs/components/atoms/Box";
import Checkbox from "@libs/components/atoms/Checkbox";
import { FormGroup } from "@libs/components/atoms/FormGroup";
import Typography from "@libs/components/atoms/Typography";
import type { SingleChoiceProps } from "@libs/components/fields/Choice/interfaces";
import { ItemWrapper } from "@libs/components/fields/Choice/styledComponents";

import ScoreIconMessage from "@/libs/components/IconMessage/ScoreIconMessage";

function SingleChoiceFields<V extends FieldValues>({
	form,
	name,
	options,
	label,
}: Readonly<SingleChoiceProps<V>>) {
	const {
		field: { value, onChange },
	} = useController({
		name: name as Path<V>,
		control: form.control,
		defaultValue: (options[0]?.value ?? "") as PathValue<V, Path<V>>,
	});

	return (
		<Box>
			{label && <Typography>{label}</Typography>}
			<FormGroup sx={{ gap: 2 }}>
				{options.map((option) => (
					<ItemWrapper key={option.value}>
						<Typography variant="14-regular">{option.label}</Typography>
						<Box display="flex" gap={1} alignItems="center">
							<ScoreIconMessage score={option.score} />
							<Checkbox
								checked={value === option.value}
								onChange={() => onChange(option.value)}
							/>
						</Box>
					</ItemWrapper>
				))}
			</FormGroup>
		</Box>
	);
}

export default memo(SingleChoiceFields) as typeof SingleChoiceFields;
