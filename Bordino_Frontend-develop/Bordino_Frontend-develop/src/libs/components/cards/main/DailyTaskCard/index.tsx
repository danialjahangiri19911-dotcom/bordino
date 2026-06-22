import React, { memo } from "react";

import Box from "@libs/components/atoms/Box";
import IconButton from "@libs/components/atoms/IconButton";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import ScoreIconMessage from "@/libs/components/IconMessage/ScoreIconMessage";
import ImageBox from "@/libs/components/ImageBox";
import BackIcon from "@/libs/components/icons/components/Back";
import DoneIcon from "@/libs/components/icons/components/Done";

export interface DailyTasksProps {
	image: string;
	title: string;
	score: string | number;
	status: "done" | "notDone";
	handleGoTask?: () => void;
}

function DailyTaskCard({
	image,
	score,
	status,
	title,
	handleGoTask,
}: Readonly<DailyTasksProps>) {
	return (
		<DailyTaskCardWrapper>
			<CardDetailWrapper>
				<ImageBox src={image} width={40} />
				<Box display="flex" flexDirection="column" gap={1}>
					<Typography variant="14-medium">{title}</Typography>
					<ScoreIconMessage score={score} />
				</Box>
			</CardDetailWrapper>
			{status === "done" ? (
				<DoneIcon color="success" />
			) : (
				<IconButton onClick={handleGoTask}>
					<BackIcon />
				</IconButton>
			)}
		</DailyTaskCardWrapper>
	);
}

export default memo(DailyTaskCard);

const DailyTaskCardWrapper = styled(Box)(({ theme }) => ({
	padding: theme.spacing(1.5),
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	maxHeight: 80,
}));

const CardDetailWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	gap: theme.spacing(1.5),
}));
