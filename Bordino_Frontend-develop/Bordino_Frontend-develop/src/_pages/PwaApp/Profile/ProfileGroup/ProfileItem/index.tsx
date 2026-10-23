import React, { type ReactElement, type ReactNode, memo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import IconButton from "@/libs/components/atoms/IconButton";
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
	return (
		<Wrapper>
			<Box display="flex" gap={1} alignItems="center">
				{icon}
				<Typography variant="14-medium">{title}</Typography>
			</Box>
			{ActionComponent ?? (
				<IconButton onClick={handleGoTask}>
					<BackIcon />
				</IconButton>
			)}
		</Wrapper>
	);
}

export default memo(ProfileItem);

const Wrapper = styled(Box)(() => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
}));
