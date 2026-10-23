import React, { type ReactElement, type ReactNode, memo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import ButtonBase from "@mui/material/ButtonBase";

import BackIcon from "@/libs/components/icons/components/Back";

export interface ProfileItemProps {
	icon: ReactNode;
	title: string;
	ActionComponent?: ReactElement;
	handleGoTask?: () => void;
}

function ProfileItem({
	ActionComponent,
	icon,
	title,
	handleGoTask,
}: Readonly<ProfileItemProps>) {
	const content = (
		<>
			<Box display="flex" gap={1} alignItems="center">
				{icon}
				<Typography variant="14-medium">{title}</Typography>
			</Box>
			{ActionComponent ?? <BackIcon />}
		</>
	);

	// A row with an action is ONE button (the whole row is tappable, 48 px high, named by its title).
	if (handleGoTask && !ActionComponent) {
		return (
			<RowButton onClick={handleGoTask} aria-label={title}>
				{content}
			</RowButton>
		);
	}
	return <Wrapper>{content}</Wrapper>;
}

export default memo(ProfileItem);

const rowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	width: "100%",
};

const Wrapper = styled(Box)(() => rowSx);

const RowButton = styled(ButtonBase)(() => ({
	...rowSx,
	minHeight: 48,
	borderRadius: 8,
	textAlign: "start",
}));
