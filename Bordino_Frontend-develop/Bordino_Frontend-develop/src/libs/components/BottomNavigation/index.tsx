import { type ReactNode, useEffect, useMemo, useState } from "react";

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
		_: React.ChangeEvent<{}>,
		newValue: number,
	) => {
		setValue(newValue);
		push(items[newValue].path);
	};

	const renderBottomNavigationItems = useMemo(() => {
		return items.map((item, index) => (
			<BottomNavigationAction
				key={`${item.title}${index}`}
				label={item.title}
				icon={item.icon}
				sx={{
					color: value === index ? "success.light" : "text.secondary",
					paddingInline: 0,
					minWidth: "auto",
				}}
			/>
		));
	}, [items, value]);

	return (
		<BottomNavigationWrapper sx={sx}>
			<BaseBottomNavigation
				showLabels
				value={value}
				onChange={handleNavigationChange}
				sx={{ width: "100%" }}
			>
				{renderBottomNavigationItems}
			</BaseBottomNavigation>
		</BottomNavigationWrapper>
	);
}

export const BottomNavigationWrapper = styled(Paper)(({ theme }) => ({
	boxShadow: theme.shadows[4],
	borderRadius: theme.shape.borderRadius * 2,
	paddingBlock: theme.spacing(2),
	margin: theme.spacing(1, 0),
	backgroundColor: theme.palette.background.paper,
	position: "fixed",
	zIndex: 6,
	bottom: 0,
	width: "90%",
	minWidth: 320,
	maxWidth: 600,
	left: "50%",
	transform: "translateX(-50%)",
}));
