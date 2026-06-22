import Box from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

export const ItemWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	border: `1px solid ${theme.palette.grey[300]}`,
	padding: theme.spacing(1),
	borderRadius: theme.shape.borderRadius,
}));
