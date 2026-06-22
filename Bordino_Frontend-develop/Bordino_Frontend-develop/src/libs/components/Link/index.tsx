import type { ReactNode } from "react";

import { default as NextLink } from "next/link";

import styled from "@libs/styles/styled";

interface LinkProps {
	href: string;
	children: ReactNode;
}

export default function Link({ href, children }: Readonly<LinkProps>) {
	return <CustomLink href={href}>{children}</CustomLink>;
}
const CustomLink = styled(NextLink)(() => ({
	textDecoration: "none",
	color: "red",
}));
