import type { ReactNode } from "react";
import { memo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

interface Props {
	children: ReactNode;
	title: string;
	extraContent?: ReactNode;
}

function TitleComponent({ children, extraContent, title }: Readonly<Props>) {
	return (
		<Wrapper>
			<Box display="flex" justifyContent="space-between">
				<Typography variant="12-regular">{title}</Typography>
				{extraContent && (
					<Typography variant="11-regular">{extraContent}</Typography>
				)}
			</Box>
			{children}
		</Wrapper>
	);
}

export default memo(TitleComponent);

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(1),
}));
