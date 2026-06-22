import { type ReactNode, useEffect, useMemo, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import BaseBottomNavigation, {
	BottomNavigationAction,
} from "@libs/components/atoms/BottomNavigation";
import Paper, { type PaperProps } from "@libs/components/atoms/Paper";
import styled from "@libs/styles/styled";

interface BottomNavigationItem {
	title: string;
	path: string;
	icon: ReactNode;
}
interface Props {
	items: BottomNavigationItem[];
	sx?: PaperProps["sx"];
}

export default function BottomNavigation({ items, sx = {} }: Readonly<Props>) {
	const [value, setValue] = useState(0);
	const { push } = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		const index = items.findIndex((item) => pathname.includes(item.path));
		if (index !== -1) {
			setValue(index);
		}
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
