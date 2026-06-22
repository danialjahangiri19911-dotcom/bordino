import { Fragment, memo, useMemo } from "react";

import { useRouter } from "next/navigation";

import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import styled from "@libs/styles/styled";

import { LOTTERY } from "@/constants/routes";
import TitleComponent from "@/libs/components/TitleComponent";
import type { DailyTasksProps } from "@/libs/components/cards/main/DailyTaskCard";
import DailyTaskCard from "@/libs/components/cards/main/DailyTaskCard";

interface Props {
	tasks: DailyTasksProps[];
	title?: string;
	extraContent?: string;
}

function DailyTasks({ tasks, extraContent, title }: Readonly<Props>) {
	const { push } = useRouter();
	const RenderDailyTasksCard = useMemo(
		() =>
			tasks.map((task, index) => (
				<Fragment key={task.title}>
					<DailyTaskCard {...task} handleGoTask={() => push(LOTTERY.path)} />
					{index < tasks.length - 1 && <Divider sx={{ color: "grey.200" }} />}
				</Fragment>
			)),
		[push, tasks],
	);

	const doneTasksCount = useMemo(
		() => tasks.filter((task) => task.status === "done").length,
		[tasks],
	);

	return (
		<TitleComponent
			{...{ extraContent }}
			title={title ?? ` ماموریت‌های روزانه (${doneTasksCount}/3) 🎯`}
		>
			<DailyTasksWrapper>{RenderDailyTasksCard}</DailyTasksWrapper>
		</TitleComponent>
	);
}

export default memo(DailyTasks);

const DailyTasksWrapper = styled(Box)(({ theme }) => ({
	border: `1px solid ${theme.palette.grey[200]}`,
	borderRadius: theme.shape.borderRadius * 2,
}));
