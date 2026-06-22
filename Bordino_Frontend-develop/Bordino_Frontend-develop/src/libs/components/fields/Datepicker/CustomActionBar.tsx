import { useMemo } from "react";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import { type PickersActionBarProps } from "@libs/components/atoms/DatePicker";

export default function CustomActionBar(
	props: Readonly<PickersActionBarProps>,
) {
	const { onSetToday, onClear, onCancel, onAccept, actions, className } = props;

	const actionButtons = useMemo(() => {
		if (!actions || actions.length === 0) {
			return null;
		}
		return actions?.map((actionType, i) => {
			switch (actionType) {
				case "clear":
					return (
						<Button
							sx={{ width: "max-content" }}
							onClick={onClear}
							variant="outlined"
							key={actionType + i}
						>
							پاک کردن
						</Button>
					);
				case "cancel":
					return (
						<Button
							sx={{ width: "max-content" }}
							onClick={onCancel}
							variant="text"
							key={actionType + i}
						>
							انصراف
						</Button>
					);
				case "accept":
					return (
						<Button
							sx={{ width: "max-content" }}
							onClick={onAccept}
							variant="text"
							key={actionType + i}
						>
							پذیرفتن
						</Button>
					);
				case "today":
					return (
						<Button
							sx={{ width: "max-content" }}
							onClick={onSetToday}
							variant="text"
							key={actionType + i}
						>
							امروز
						</Button>
					);
				default:
					return null;
			}
		});
	}, [actions, onSetToday, onClear, onCancel, onAccept]);

	if (!actionButtons) {
		return null;
	}

	return (
		<Box
			className={className}
			display="flex"
			justifyContent="space-between"
			alignItems="center"
			mb={1}
		>
			{actionButtons}
		</Box>
	);
}
