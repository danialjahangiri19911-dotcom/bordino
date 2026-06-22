import Box from "@/libs/components/atoms/Box";
import styled from "@/libs/styles/styled";

export const LotteryContentWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
}));
