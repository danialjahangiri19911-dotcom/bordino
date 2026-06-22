import { memo } from "react";
import type { ReactNode } from "react";

import Box from "@libs/components/atoms/Box";
import Drawer, { type DrawerProps } from "@libs/components/atoms/Drawer";
import Typography, {
	type TypographyProps,
} from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

export interface BaseDrawerModalProps {
	open: boolean;
	onClose?: () => void;
	children: ReactNode;
	anchor?: DrawerProps["anchor"];
	sx?: DrawerProps["sx"];
	title?: string;
	titleVariant?: TypographyProps["variant"];
}

function BaseDrawer({
	open,
	onClose,
	children,
	title,
	anchor = "bottom",
	sx = {},
	titleVariant,
}: Readonly<BaseDrawerModalProps>) {
	return (
		<StyledDrawer open={open} onClose={onClose} anchor={anchor} sx={sx}>
			<DragIndicator />

			<Title>
				{title && <Typography variant={titleVariant}>{title}</Typography>}
			</Title>

			<Box sx={{ padding: 0, ...sx }}>{children}</Box>
		</StyledDrawer>
	);
}

export default memo(BaseDrawer);

const StyledDrawer = styled(Drawer)(() => ({
	"& .MuiPaper-root": {
		maxWidth: "600px",
		margin: "0 auto",
	},
}));

const DragIndicator = styled(Box)(({ theme }) => ({
	width: 40,
	height: 4,
	backgroundColor: theme.palette.grey[400],
	borderRadius: 2,
	margin: "0 auto",
	marginTop: theme.spacing(1),
}));

const Title = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: theme.spacing(2),
}));
