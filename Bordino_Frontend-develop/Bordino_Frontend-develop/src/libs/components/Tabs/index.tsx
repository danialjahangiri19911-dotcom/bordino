"use client";

import type { ReactNode, SyntheticEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import TabPanel from "./TabPanel";
import Box, { type BoxProps } from "@libs/components/atoms/Box";
import Tabs, {
	Tab,
	type TabProps,
	type TabsProps,
} from "@libs/components/atoms/Tabs";
import styled, { useTheme } from "@libs/styles/styled";

export interface TabItem {
	label: string;
	content: ReactNode;
}

export interface BasicTabsProps {
	tabs: TabItem[];
	sx?: TabsProps["sx"];
	headerSx?: BoxProps["sx"];
	TabSx?: TabProps["sx"];
	contentSx?: BoxProps["sx"];
	indicatorColor?: BoxProps["color"];
	hasShadow?: boolean;
	variants?: TabsProps["variant"];
}

export default function BasicTabs({
	tabs,
	sx,
	headerSx,
	TabSx,
	contentSx,
	indicatorColor,
	hasShadow,
	variants = "fullWidth",
}: Readonly<BasicTabsProps>) {
	const [currentIndex, setCurrentIndex] = useState<number>(0);
	const theme = useTheme();

	const indicatorCurrentColor = useMemo(() => {
		return typeof indicatorColor === "string"
			? indicatorColor
			: theme.palette.secondary.main;
	}, [indicatorColor, theme.palette.secondary.main]);

	const changeHandler = useCallback(
		(event: SyntheticEvent, newValue: number) => {
			setCurrentIndex(newValue);
		},
		[],
	);

	return (
		<Wrapper
			sx={{
				...sx,
				boxShadow: hasShadow ? (theme) => theme.shadows[1] : "none",
			}}
		>
			<Box
				sx={{
					borderBottom: 1,
					borderColor: "divider",
					...headerSx,
				}}
			>
				<Tabs value={currentIndex} onChange={changeHandler} variant={variants}>
					{tabs.map(({ label }, index) => (
						<CustomTab
							sx={{
								...TabSx,
								color: indicatorCurrentColor,
							}}
							key={index.toString() + label}
							label={label}
						/>
					))}
				</Tabs>
			</Box>
			<Box sx={contentSx}>
				{tabs.map(({ content }, index) => (
					<TabPanel
						sx={{ pr: 0, pl: 0 }}
						key={`${index.toString()}`}
						value={currentIndex}
						index={index}
					>
						{content}
					</TabPanel>
				))}
			</Box>
		</Wrapper>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	borderRadius: theme.shape.borderRadius * 4,
	height: "max-content",
}));

const CustomTab = styled(Tab)(({ theme }) => ({
	color: "rgba(12, 12, 12, 1) !important",
	fontWeight: theme.typography.fontWeightRegular,
	"&.Mui-selected": {
		color: "rgba(197, 18, 40, 1) !important",
		fontWeight: theme.typography.fontWeightBold,
		borderTopLeftRadius: theme.shape.borderRadius,
		borderTopRightRadius: theme.shape.borderRadius,
		transition: "background-color 0.3s ease-in-out, color 0.3s ease-in-out",
	},
	"&:hover": {
		backgroundColor: theme.palette.action.hover,
	},
	"&.MuiTab-root": {
		borderRadius: "0",
	},
	"&:first-of-type.Mui-selected": {
		borderTopLeftRadius: theme.shape.borderRadius,
	},
	"&:last-of-type.Mui-selected": {
		borderTopRightRadius: theme.shape.borderRadius,
	},
}));
