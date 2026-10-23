"use client";

import {
	type ReactNode,
	type SyntheticEvent,
	useEffect,
	useState,
} from "react";

import { usePathname, useRouter } from "next/navigation";

import BaseBottomNavigation, {
	BottomNavigationAction,
} from "@libs/components/atoms/BottomNavigation";
import Paper, { type PaperProps } from "@libs/components/atoms/Paper";
import styled from "@libs/styles/styled";

import { GAME_NET, MAIN_APP } from "@/constants/routes";

interface BottomNavigationItem {
	title: string;
	path: string;
	icon: ReactNode;
}

interface Props {
	items: BottomNavigationItem[];
	sx?: PaperProps["sx"];
}

const SECTION_OF: [string, string][] = [
	...["/pwa/2048", "/pwa/sudoku", "/pwa/crash", "/pwa/chicken"].map(
		(prefix): [string, string] => [prefix, GAME_NET.path],
	),
	...["/pwa/lottery", "/pwa/wheel", "/pwa/tarot", "/pwa/hafez"].map(
		(prefix): [string, string] => [prefix, MAIN_APP.path],
	),
];

export default function BottomNavigation({ items, sx = {} }: Readonly<Props>) {
	const [value, setValue] = useState<number | false>(false);
	const { push } = useRouter();
	const pathname = usePathname();

	// The tab of the section a page belongs to: games under گیمنت, lottery/wheel/fal under home;
	// a page of no section selects no tab (it used to keep whatever was selected before).
	useEffect(() => {
		const section = SECTION_OF.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? pathname;
		const index = items.findIndex((item) => section.startsWith(item.path));
		setValue(index === -1 ? false : index);
	}, [pathname, items]);

	const handleNavigationChange = (
		_: SyntheticEvent,
		newValue: number,
	) => {
		setValue(newValue);
		push(items[newValue].path);
	};

	return (
		<BottomNavigationWrapper
			role="navigation"
			aria-label="ناوبری اصلی"
			dir="rtl"
			elevation={0}
			sx={sx}
		>
			<BaseBottomNavigation
				value={value}
				onChange={handleNavigationChange}
				// Custom styles control label visibility and horizontal expansion.
				showLabels
				sx={{
					inlineSize: "100%",
					minInlineSize: 0,
					height: 44,
					gap: "4px",
					backgroundColor: "transparent",
				}}
			>
				{items.map((item, index) => (
					<NavigationAction
						key={`${item.title}${index}`}
						value={index}
						type="button"
						disableRipple
						aria-label={item.title}
						aria-current={value === index ? "page" : undefined}
						label={<span aria-hidden="true">{item.title}</span>}
						icon={
							<span className="navigation-icon" aria-hidden="true">
								{item.icon}
							</span>
						}
					/>
				))}
			</BaseBottomNavigation>
		</BottomNavigationWrapper>
	);
}

const NavigationAction = styled(BottomNavigationAction)({
	// Override MUI's vertical layout and selected-label sizing.
	"&&": {
		boxSizing: "border-box",
		flex: "1 1 0%",
		minWidth: 44,
		maxWidth: "none",
		minInlineSize: 44,
		minBlockSize: 44,
		blockSize: 44,
		paddingBlock: 0,
		paddingInline: 8,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 16,
		color: "#231F20",
		backgroundColor: "transparent",
		fontFamily: "inherit",
		textTransform: "none",
		WebkitTapHighlightColor: "transparent",
		transition:
			"flex-grow 180ms ease, background-color 180ms ease, color 180ms ease",

		"& .navigation-icon": {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "0 0 24px",
			inlineSize: 24,
			blockSize: 24,
			color: "inherit",
			"& svg": {
				display: "block",
				inlineSize: 24,
				blockSize: 24,
			},
		},

		"& .MuiBottomNavigationAction-label": {
			display: "block",
			flex: "0 1 auto",
			minInlineSize: 0,
			maxInlineSize: 0,
			marginInlineStart: 0,
			overflow: "hidden",
			whiteSpace: "nowrap",
			textOverflow: "ellipsis",
			fontFamily: "inherit",
			fontSize: "0.75rem",
			fontWeight: 700,
			lineHeight: 1.75,
			letterSpacing: 0,
			opacity: 0,
			visibility: "hidden",
			transform: "none",
			transition:
				"max-inline-size 180ms ease, margin-inline-start 180ms ease, opacity 180ms ease",
		},

		"&.Mui-selected": {
			flexGrow: 1.8,
			color: "#E64056",
			backgroundColor: "#FFF1F3",

			"& .MuiBottomNavigationAction-label": {
				maxInlineSize: "6em",
				marginInlineStart: 6,
				opacity: 1,
				visibility: "visible",
				// A deeper brand red keeps the small label readable.
				color: "#AD3041",
			},
		},

		"@media (hover: hover)": {
			"&:hover": {
				backgroundColor: "#E9EEF3",
			},
			"&.Mui-selected:hover": {
				color: "#D13A4E",
				backgroundColor: "#FBE2E6",
			},
		},

		"&:active": {
			backgroundColor: "#E9EEF3",
		},
		"&.Mui-selected:active": {
			color: "#D13A4E",
			backgroundColor: "#FBE2E6",
		},

		"&:focus-visible, &.Mui-focusVisible": {
			outline: "2px solid #D13A4E",
			outlineOffset: 2,
		},

		"@media (prefers-reduced-motion: reduce)": {
			transition: "none",
			"& .MuiBottomNavigationAction-label": {
				transition: "none",
			},
		},
	},
});

export const BottomNavigationWrapper = styled(Paper)({
	position: "fixed",
	zIndex: 6,
	insetBlockEnd: 0,
	insetInline: 0,
	marginInline: "auto",
	boxSizing: "border-box",
	inlineSize: "100%",
	maxInlineSize: 600,
	minInlineSize: 0,

	// 7 + 44 + 7 = 58px, plus the device's bottom safe area.
	paddingBlockStart: 7,
	paddingBlockEnd: "calc(7px + env(safe-area-inset-bottom, 0px))",
	paddingInline: 8,

	borderRadius: 0,
	borderStartStartRadius: 18,
	borderStartEndRadius: 18,
	backgroundColor: "#FFFFFF",
	backgroundImage: "none",
	boxShadow:
		"0 -4px 20px rgba(35, 31, 32, 0.06), inset 0 1px 0 #E9EEF3",
});
