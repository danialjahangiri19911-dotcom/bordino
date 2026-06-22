import { memo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";

import Box from "@libs/components/atoms/Box";
import Checkbox from "@libs/components/atoms/Checkbox";
import { FormGroup } from "@libs/components/atoms/FormGroup";
import Typography from "@libs/components/atoms/Typography";
import type { MultiPictureChoiceProps } from "@libs/components/fields/Choice/interfaces";
import useFieldError from "@libs/components/fields/useFieldError";

import ImageBox from "@/libs/components/ImageBox";

function MultiPictureChoiceFields<V extends FieldValues>({
	form,
	name,
	options,
}: Readonly<MultiPictureChoiceProps<V>>) {
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
			<FormGroup
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: { xs: 1, sm: 2 },
				}}
			>
				{options.map((option) => {
					const isSelected = value.includes(option.value);
					return (
						<Box
							key={option.value}
							sx={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								border: isSelected
									? `1px solid ${option.color}`
									: "1px solid transparent",
								borderRadius: 2,
								cursor: "pointer",
								transition: "border 0.2s ease-in-out",
								boxShadow: isSelected ? 1 : "transparent",
							}}
							onClick={() => handleCheckboxChange(option.value)}
						>
							<ImageBox
								src={option.icon}
								sx={{
									width: { xs: "86px", sm: "100px" },
									height: { xs: "80px", sm: "100px" },
									aspectRatio: "1 / 1",
									objectFit: "cover",
								}}
							/>
							<Checkbox
								checked={isSelected}
								onChange={() => handleCheckboxChange(option.value)}
								color="secondary"
								sx={{ display: "none" }}
							/>
						</Box>
					);
				})}
			</FormGroup>
			{hasError && (
				<Typography color="error" variant="14-regular">
					{errorMessage}
				</Typography>
			)}
		</Box>
	);
}

export default memo(
	MultiPictureChoiceFields,
) as typeof MultiPictureChoiceFields;
