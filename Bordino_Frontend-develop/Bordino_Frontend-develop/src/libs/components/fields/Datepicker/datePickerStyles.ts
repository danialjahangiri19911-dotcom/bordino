import { useCallback } from "react";

import type { Theme } from "@libs/styles/styled";

export default function useDatePickerStyles() {
	const dayStyles = useCallback(
		(theme: Theme) => ({
			borderRadius: theme.shape.borderRadius / 4,
			lineHeight: "1.1",
			"&.MuiPickersDay-today": {
				backgroundColor: theme.palette.grey[200],
				color: theme.palette.common.black,
				border: 0,
			},
		}),
		[],
	);

	const layoutStyles = useCallback(
		(theme: Theme) => ({
			"& .MuiDateCalendar-root": {
				height: "auto",
				width: "auto",
				"& .MuiDayCalendar-slideTransition": {
					minHeight: "max-content",
					"& .MuiDayCalendar-monthContainer": {
						position: "static",
					},
				},
				"& .MuiDayCalendar-header > span": {
					...theme.typography["14-bold"],
					color: theme.palette.common.black,
				},
			},
		}),
		[],
	);

	const calendarHeaderStyles = useCallback(
		(theme: Theme) => ({
			justifyContent: "center",
			"& .MuiPickersCalendarHeader-labelContainer": {
				m: 0,
				zIndex: theme.zIndex.speedDial,
			},
			"& .MuiPickersArrowSwitcher-root": {
				position: "absolute",
				width: "90%",
				justifyContent: "space-evenly",
				"> button": { color: theme.palette.primary.main },
			},
		}),
		[],
	);

	return { dayStyles, layoutStyles, calendarHeaderStyles };
}
