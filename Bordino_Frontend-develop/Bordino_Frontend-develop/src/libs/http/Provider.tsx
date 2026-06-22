"use client";

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface Props {
	children: ReactNode;
}

const queryClient = new QueryClient({});

export default function QueryProvider({ children }: Readonly<Props>) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
